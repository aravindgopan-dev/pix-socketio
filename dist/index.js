"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST'],
}));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
// Store players by room
const rooms = {};
// Store chat history by room
const roomChats = {};
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    // Handle room joining
    socket.on('joinRoom', (roomId, playerName) => {
        console.log(`${playerName || 'Anonymous'} joining room ${roomId}`);
        // Leave any previous rooms
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
                if (rooms[room] && rooms[room][socket.id]) {
                    delete rooms[room][socket.id];
                    io.to(room).emit('updatePlayers', rooms[room]);
                }
            }
        });
        // Join the new room
        socket.join(roomId);
        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {};
            roomChats[roomId] = [];
        }
        // Add new player to the room
        rooms[roomId][socket.id] = {
            id: socket.id,
            x: 250,
            y: 250,
            direction: { x: 0, y: 0 },
            name: playerName || `Player-${socket.id.substring(0, 4)}`
        };
        // Send chat history to the new player
        socket.emit('chatHistory', roomChats[roomId]);
        // Notify room about new player
        io.to(roomId).emit('updatePlayers', rooms[roomId]);
        // Send room information to the joining player
        socket.emit('roomJoined', {
            roomId,
            playerId: socket.id,
            players: rooms[roomId]
        });
        // Broadcast a system message about the new player
        const systemMessage = {
            sender: 'System',
            message: `${rooms[roomId][socket.id].name} joined the room`,
            timestamp: Date.now(),
            roomId
        };
        roomChats[roomId].push(systemMessage);
        io.to(roomId).emit('newMessage', systemMessage);
    });
    // Handle movement updates
    socket.on('move', ({ roomId, x, y, direction }) => {
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            rooms[roomId][socket.id].x = x;
            rooms[roomId][socket.id].y = y;
            rooms[roomId][socket.id].direction = direction;
            io.to(roomId).emit('updatePlayers', rooms[roomId]);
        }
    });
    // Handle chat messages
    socket.on('sendMessage', ({ roomId, message }) => {
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            const player = rooms[roomId][socket.id];
            const chatMessage = {
                sender: player.name || socket.id,
                message,
                timestamp: Date.now(),
                roomId
            };
            roomChats[roomId].push(chatMessage);
            io.to(roomId).emit('newMessage', chatMessage);
        }
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            if (rooms[roomId][socket.id]) {
                const playerName = rooms[roomId][socket.id].name;
                // Notify room about player leaving
                const systemMessage = {
                    sender: 'System',
                    message: `${playerName || 'A player'} left the room`,
                    timestamp: Date.now(),
                    roomId
                };
                roomChats[roomId].push(systemMessage);
                io.to(roomId).emit('newMessage', systemMessage);
                // Remove player from room
                delete rooms[roomId][socket.id];
                io.to(roomId).emit('updatePlayers', rooms[roomId]);
                // Clean up empty rooms
                if (Object.keys(rooms[roomId]).length === 0) {
                    delete rooms[roomId];
                    delete roomChats[roomId];
                }
            }
        }
    });
});
// REST API endpoints
app.get('/', (req, res) => {
    res.send('Game and Chat Server with Socket.IO');
});
app.get('/rooms', (req, res) => {
    const roomList = Object.keys(rooms).map(roomId => ({
        id: roomId,
        playerCount: Object.keys(rooms[roomId]).length
    }));
    res.json(roomList);
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
