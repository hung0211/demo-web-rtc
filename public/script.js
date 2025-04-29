const ws = new WebSocket(`wss://${window.location.hostname}`);
let localStream;
let peerConnections = {};
let myName = '';
let selectedClient = '';

document.getElementById('connectBtn').addEventListener('click', register);
document.getElementById('callButton').addEventListener('click', startCall);
document.getElementById('hangupButton').addEventListener('click', closeAllConnections);

async function register() {
  myName = document.getElementById('nameInput').value.trim();
  if (!myName) return alert("Vui lòng nhập tên!");

  ws.send(JSON.stringify({ type: 'register', name: myName }));

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;
}

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'clientList') {
    updateClientList(message.clients);
  } else if (message.type === 'endCall') {
    closeAllConnections();
  } else {
    await handleMessage(message);
  }
};

function updateClientList(clients) {  const list = document.getElementById('clientList');
  list.innerHTML = '';

  clients.forEach(name => {
    if (name !== myName) {
      const listItem = document.createElement('li');
      listItem.textContent = name;
      listItem.onclick = () => selectClient(name);
      list.appendChild(listItem);
    }
  });
}

function selectClient(name) {
  selectedClient = name;
  document.getElementById('callButton').disabled = false;
}

async function startCall() {
  if (!selectedClient) return alert("Chọn một thiết bị để gọi!");

  closeAllConnections();
  const pc = setupPeerConnection(selectedClient);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  ws.send(JSON.stringify({ type: 'offer', offer, target: selectedClient, sender: myName }));
  document.getElementById('hangupButton').disabled = false;
}

function setupPeerConnection(targetClient) {
    const pc = new RTCPeerConnection({
        iceServers: [
            {
              urls: "stun:stun.relay.metered.ca:80",
            },
            {
              urls: "turn:standard.relay.metered.ca:80",
              username: "1f49ebbe561c979947c64b3a",
              credential: "ejFSiadw+/XA5DkY",
            },
            {
              urls: "turn:standard.relay.metered.ca:80?transport=tcp",
              username: "1f49ebbe561c979947c64b3a",
              credential: "ejFSiadw+/XA5DkY",
            },
            {
              urls: "turn:standard.relay.metered.ca:443",
              username: "1f49ebbe561c979947c64b3a",
              credential: "ejFSiadw+/XA5DkY",
            },
            {
              urls: "turns:standard.relay.metered.ca:443?transport=tcp",
              username: "1f49ebbe561c979947c64b3a",
              credential: "ejFSiadw+/XA5DkY",
            },
        ],
      });
      

  pc.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: "candidate",
        candidate: event.candidate,
        target: targetClient,
        sender: myName
      }));
    }
  };

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  peerConnections[targetClient] = pc;
  return pc;
}

async function handleMessage(message) {
  if (message.type === 'offer') {
    closeAllConnections();

    const accept = confirm(`${message.sender} đang gọi. Bạn có muốn nhận cuộc gọi không?`);
    if (!accept) {
      ws.send(JSON.stringify({ type: 'endCall', sender: myName, target: message.sender }));
      return;
    }

    const pc = setupPeerConnection(message.sender);
    await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({ type: 'answer', answer, target: message.sender, sender: myName }));
    document.getElementById('hangupButton').disabled = false;
  } else if (message.type === 'answer') {
    const pc = peerConnections[message.sender];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
  } else if (message.type === 'candidate') {
    const pc = peerConnections[message.sender];
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
  }
}

function closeAllConnections() {
  for (let target in peerConnections) {
    peerConnections[target].close();
    delete peerConnections[target];
  }
  document.getElementById('hangupButton').disabled = true;
}
