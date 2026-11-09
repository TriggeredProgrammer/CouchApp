const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

// room state: { src, playing, time, updatedAt }
const rooms = {};
const now = () => Date.now() / 1000;
const currentTime = (r) => (r.playing ? r.time + (now() - r.updatedAt) : r.time);

io.on("connection", (socket) => {
  socket.on("join", ({ room, name }) => {
    socket.data = { room, name: name || "Guest" };
    socket.join(room);
    rooms[room] ||= { src: "", playing: false, time: 0, updatedAt: now() };
    const r = rooms[room];
    socket.emit("state", { src: r.src, playing: r.playing, time: currentTime(r) });
    io.to(room).emit("count", io.sockets.adapter.rooms.get(room).size);
    socket.to(room).emit("chat", { name: "•", text: `${socket.data.name} joined` });
  });

  socket.on("source", (src) => {
    const { room } = socket.data || {};
    if (!room) return;
    Object.assign(rooms[room], { src, playing: false, time: 0, updatedAt: now() });
    io.to(room).emit("state", { src, playing: false, time: 0 });
  });

  socket.on("control", ({ playing, time }) => {
    const { room } = socket.data || {};
    if (!room) return;
    Object.assign(rooms[room], { playing, time, updatedAt: now() });
    socket.to(room).emit("control", { playing, time });
  });

  socket.on("chat", (text) => {
    const { room, name } = socket.data || {};
    if (room) io.to(room).emit("chat", { name, text: String(text).slice(0, 500) });
  });

  socket.on("disconnect", () => {
    const { room } = socket.data || {};
    if (!room) return;
    const set = io.sockets.adapter.rooms.get(room);
    if (set) io.to(room).emit("count", set.size);
    else delete rooms[room];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running on http://localhost:" + PORT));
