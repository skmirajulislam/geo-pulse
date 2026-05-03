import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MessageCircle, X, Plus, LogOut, Send, Trash2, UserX } from "lucide-react";
import { BACKEND_URL, createChatRoom, fetchChatRooms } from "../services/api";
import "./component-css/RoomChatPopup.css";

const buildSystemMessage = (text) => ({
  id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  username: "System",
  message: text,
  timestamp: new Date().toISOString(),
  isSystem: true,
});

export default function RoomChatPopup() {
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState("");
  const [joinName, setJoinName] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [createForm, setCreateForm] = useState({
    roomName: "",
    topic: "",
    ownerName: "",
  });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loadRooms = useCallback(async () => {
    try {
      setLoadingRooms(true);
      setError("");
      const roomList = await fetchChatRooms();
      setRooms(roomList);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setIsSocketConnected(true));
    socket.on("disconnect", () => setIsSocketConnected(false));
    socket.on("chat:rooms-updated", ({ rooms: nextRooms }) => {
      setRooms(nextRooms || []);
    });
    socket.on("chat:message", (payload) => {
      if (sessionRef.current && payload?.roomId === sessionRef.current.roomId) {
        setMessages((prev) => [...prev, payload]);
      }
    });
    socket.on("chat:presence", ({ type, room, user }) => {
      if (!room) return;
      if (sessionRef.current && room.id === sessionRef.current.roomId) {
        setCurrentRoom(room);
        const note =
          type === "join"
            ? `${user?.username || "A user"} joined`
            : type === "kick"
              ? `${user?.username || "A user"} was removed`
              : `${user?.username || "A user"} left`;
        setMessages((prev) => [...prev, buildSystemMessage(note)]);
      }
    });
    socket.on("chat:removed", ({ roomId, reason }) => {
      if (sessionRef.current && roomId === sessionRef.current.roomId) {
        setMessages((prev) => [...prev, buildSystemMessage(reason || "You were removed from this room")]);
        setSession(null);
        setCurrentRoom(null);
      }
    });
    socket.on("chat:room-deleted", ({ roomId, reason }) => {
      if (sessionRef.current && roomId === sessionRef.current.roomId) {
        setMessages((prev) => [...prev, buildSystemMessage(reason || "Room was deleted")]);
        setSession(null);
        setCurrentRoom(null);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isOpen) loadRooms();
  }, [isOpen, loadRooms]);

  const isOwner = useMemo(() => {
    if (!session || !currentRoom) return false;
    return currentRoom.owner?.userId === session.userId;
  }, [session, currentRoom]);

  const joinExistingRoom = async (room) => {
    if (!socketRef.current) return;
    if (!joinName.trim()) {
      setError("Enter your name before joining a room");
      return;
    }

    socketRef.current.emit(
      "chat:join",
      { roomId: room.id, username: joinName.trim() },
      (ack) => {
        if (!ack?.ok) {
          setError(ack?.error || "Unable to join room");
          return;
        }
        setSession({
          roomId: ack.room.id,
          userId: ack.user.userId,
          username: ack.user.username,
          role: ack.user.role,
        });
        setCurrentRoom(ack.room);
        setMessages([buildSystemMessage(`You joined ${ack.room.name}`)]);
        setError("");
      }
    );
  };

  const createAndJoinRoom = async () => {
    try {
      setError("");
      if (!createForm.roomName.trim() || !createForm.ownerName.trim()) {
        setError("Room name and your name are required");
        return;
      }

      const room = await createChatRoom({
        roomName: createForm.roomName.trim(),
        topic: createForm.topic.trim(),
        ownerName: createForm.ownerName.trim(),
      });

      if (!socketRef.current) return;
      socketRef.current.emit(
        "chat:join",
        {
          roomId: room.id,
          userId: room.owner.userId,
          username: room.owner.username,
        },
        (ack) => {
          if (!ack?.ok) {
            setError(ack?.error || "Unable to join new room");
            return;
          }
          setSession({
            roomId: ack.room.id,
            userId: ack.user.userId,
            username: ack.user.username,
            role: ack.user.role,
          });
          setCurrentRoom(ack.room);
          setMessages([buildSystemMessage(`Room "${ack.room.name}" created successfully`)]);
          setCreateForm({ roomName: "", topic: "", ownerName: "" });
        }
      );
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to create room");
    }
  };

  const leaveCurrentRoom = () => {
    if (!socketRef.current || !session) return;
    socketRef.current.emit(
      "chat:leave",
      { roomId: session.roomId, userId: session.userId },
      () => {
        setSession(null);
        setCurrentRoom(null);
        setMessages([]);
      }
    );
  };

  const sendMessage = () => {
    if (!socketRef.current || !session || !chatInput.trim()) return;
    socketRef.current.emit(
      "chat:send",
      {
        roomId: session.roomId,
        userId: session.userId,
        username: session.username,
        message: chatInput.trim(),
      },
      (ack) => {
        if (!ack?.ok) {
          setError(ack?.error || "Failed to send message");
          return;
        }
        setChatInput("");
      }
    );
  };

  const removeMember = (userId) => {
    if (!socketRef.current || !session || !currentRoom) return;
    socketRef.current.emit(
      "chat:kick",
      {
        roomId: currentRoom.id,
        ownerUserId: session.userId,
        targetUserId: userId,
      },
      (ack) => {
        if (!ack?.ok) setError(ack?.error || "Failed to remove user");
      }
    );
  };

  const deleteRoom = () => {
    if (!socketRef.current || !session || !currentRoom) return;
    socketRef.current.emit(
      "chat:delete-room",
      {
        roomId: currentRoom.id,
        ownerUserId: session.userId,
      },
      (ack) => {
        if (!ack?.ok) {
          setError(ack?.error || "Failed to delete room");
          return;
        }
        setSession(null);
        setCurrentRoom(null);
        setMessages([]);
      }
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="glass-panel rounded-md rcp-trigger"
        title="Open live communication rooms"
      >
        <MessageCircle size={16} />
        <span className="rcp-trigger-label">Rooms</span>
      </button>

      {isOpen && (
        <div className="rcp-overlay">
          <div className="rcp-panel glass-panel">
            <div className="rcp-header">
              <div>
                <div className="rcp-title">Live Communication Rooms</div>
                <div className="rcp-subtitle">
                  {isSocketConnected ? "WebSocket connected" : "WebSocket disconnected"}
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="rcp-icon-btn">
                <X size={16} />
              </button>
            </div>

            {error && <div className="rcp-error">{error}</div>}

            {!session && (
              <>
                <div className="rcp-section">
                  <div className="rcp-section-title">Join Existing Room</div>
                  <input
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Your display name"
                    className="rcp-input"
                  />
                  <div className="rcp-room-list">
                    {loadingRooms && <div className="rcp-empty">Loading rooms...</div>}
                    {!loadingRooms && rooms.length === 0 && (
                      <div className="rcp-empty">No active rooms</div>
                    )}
                    {rooms.map((room) => (
                      <div className="rcp-room-item" key={room.id}>
                        <div>
                          <div className="rcp-room-name">{room.name}</div>
                          <div className="rcp-room-topic">{room.topic || "No topic"}</div>
                          <div className="rcp-room-meta">
                            Online: {room.onlineCount} • Owner: {room.owner?.username}
                          </div>
                        </div>
                        <button
                          onClick={() => joinExistingRoom(room)}
                          className="rcp-action-btn"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rcp-section">
                  <div className="rcp-section-title">Create Room</div>
                  <div className="rcp-grid">
                    <input
                      value={createForm.ownerName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, ownerName: e.target.value }))}
                      placeholder="Your name (owner)"
                      className="rcp-input"
                    />
                    <input
                      value={createForm.roomName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, roomName: e.target.value }))}
                      placeholder="Room name"
                      className="rcp-input"
                    />
                    <input
                      value={createForm.topic}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, topic: e.target.value }))}
                      placeholder="Discussion topic"
                      className="rcp-input"
                    />
                    <button onClick={createAndJoinRoom} className="rcp-action-btn rcp-create-btn">
                      <Plus size={14} /> Create
                    </button>
                  </div>
                </div>
              </>
            )}

            {session && currentRoom && (
              <div className="rcp-chat-layout">
                <div className="rcp-chat-head">
                  <div>
                    <div className="rcp-room-name">{currentRoom.name}</div>
                    <div className="rcp-room-meta">{currentRoom.topic || "No topic"}</div>
                  </div>
                  <div className="rcp-chat-controls">
                    {isOwner && (
                      <button className="rcp-icon-btn rcp-danger" onClick={deleteRoom} title="Delete room">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button className="rcp-icon-btn" onClick={leaveCurrentRoom} title="Leave room">
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>

                <div className="rcp-chat-main">
                  <div className="rcp-messages">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`rcp-message ${msg.isSystem ? "rcp-message-system" : ""}`}>
                        <span className="rcp-message-user">{msg.username}:</span> {msg.message}
                      </div>
                    ))}
                  </div>

                  <div className="rcp-members">
                    <div className="rcp-section-title">Online Users</div>
                    {(currentRoom.members || []).map((member) => (
                      <div className="rcp-member-item" key={member.userId}>
                        <span>
                          {member.username}
                          {member.role === "owner" ? " (owner)" : ""}
                        </span>
                        {isOwner && member.userId !== session.userId && (
                          <button
                            className="rcp-icon-btn rcp-danger"
                            onClick={() => removeMember(member.userId)}
                            title="Remove user"
                          >
                            <UserX size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rcp-send-row">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendMessage();
                    }}
                    placeholder="Type message..."
                    className="rcp-input"
                  />
                  <button className="rcp-action-btn" onClick={sendMessage}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
