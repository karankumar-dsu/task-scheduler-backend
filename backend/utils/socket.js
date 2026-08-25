let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    // Frontend calls socket.emit('register', userEmail) right after connecting
    socket.on("register", (email) => {
      if (email) {
        socket.join(String(email).toLowerCase());
      }
    });

    socket.on("disconnect", () => {
      // no-op, rooms are cleaned up automatically
    });
  });
}

// Send a real-time event to every tab/device logged in with this email
function emitToEmail(email, event, payload) {
  if (!ioInstance || !email) return;
  ioInstance.to(String(email).toLowerCase()).emit(event, payload);
}

module.exports = { initSocket, emitToEmail };
