import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

function App() {
  const [session, setSession] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersOnline, setUsersOnline] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  console.log(session);

  //sign in
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  //sign out
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!session?.user) {
      setUsersOnline([]);
      return;
    }
    const roomOne = supabase.channel("room_one", {
      config: {
        presence: {
          key: session?.user?.id,
        },
      },
    });
    roomOne.on("broadcast", { event: "message" }, (payload) => {
      setMessages((prevMessages) => [...prevMessages, payload.payload]);
    });

    //track user presence subscribe!
    roomOne.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await roomOne.track({
          id: session?.user?.id,
        });
      }
    });

    //handle user presence

    roomOne.on("presence", { event: "sync" }, () => {
      const state = roomOne.presenceState();
      setUsersOnline(Object.keys(state));
    });

    return () => {
      roomOne.unsubscribe();
    };
  }, [session]);

  //send message

  const sendMessage = async (e) => {
    e.preventDefault();

    supabase.channel("room_one").send({
      type: "broadcast",
      event: "message",
      payload: {
        message: newMessage,
        user_name: session?.user?.user_metadata?.full_name,
        avatar: session?.user?.user_metadata?.avatar_url || "",
        timestamp: new Date().toISOString(),
      },
    });
    setNewMessage("");
  };

  // Exportar chat como TXT o CSV
  const exportChat = (format) => {
    if (messages.length === 0) {
      alert("No hay mensajes para exportar");
      return;
    }

    let content = "";
    let filename = `chat_export_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'txt') {
      // Formato TXT
      content = messages.map(msg => {
        const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `[${formattedTime}] ${msg.user_name}: ${msg.message}`;
      }).join('\n');
      filename += '.txt';
    } else if (format === 'csv') {
      // Formato CSV
      content = 'Fecha,Hora,Usuario,Mensaje\n';
      content += messages.map(msg => {
        const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const formattedDate = timestamp.toLocaleDateString();
        const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Escapar comillas en el mensaje para formato CSV
        const escapedMessage = msg.message.replace(/"/g, '""');
        return `"${formattedDate}","${formattedTime}","${msg.user_name}","${escapedMessage}"`;
      }).join('\n');
      filename += '.csv';
    }

    // Crear y descargar el archivo
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session) {
    return (
      <div className="w-full flex h-screen justify-center items-center">
        <button onClick={signIn} className="neo-button">Sign in with Google</button>
      </div>
    );
  } else {
    return (
      <div className="w-full flex h-screen justify-center items-center p-4">
        <div className="border-[1px] border-gray-700 max-w-6xl w-full min-h-[600px] rounded-lg neo-container flex flex-col">
          {/**Header */}
          <div className="flex justify-between h-20 border-b-[1px] border-gray-700 neo-header">
            <div className="p-4">
              <p className="font-bold">
                <span className="signed-text">Signed in as </span>{session?.user?.user_metadata?.full_name}
              </p>
              <p className="italic text-sm font-bold">
                <span className="hidden sm:inline">{usersOnline.length} {usersOnline.length === 1 ? 'usuario' : 'usuarios'} online</span>
                <span className="sm:hidden flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-500 mr-1"></span>
                  {usersOnline.length}
                </span>
              </p>
            </div>
            <div className="flex items-center">
              <button onClick={() => exportChat('txt')} className="m-2 neo-button neo-button-export">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Exportar TXT</span>
              </button>
              <button onClick={() => exportChat('csv')} className="m-2 neo-button neo-button-export">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Exportar CSV</span>
              </button>
              <button onClick={signOut} className="m-2 sm:mr-4 neo-button">
                Sign Out
              </button>
            </div>
          </div>
          {/**main chat */}
          <div className="p-4 flex flex-col overflow-y-auto flex-grow chat-messages" style={{ maxHeight: "calc(100vh - 250px)" }}>
            {messages.map((msg, idx) => {
              // Format timestamp
              const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();
              const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              const isCurrentUser = msg?.user_name === session?.user?.user_metadata?.full_name;
              
              return (
                <div
                  key={idx}
                  className={`my-3 flex w-full ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex flex-col neo-message-container">
                    <div className={`flex items-start ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar */}
                      <img 
                        src={isCurrentUser 
                          ? (msg?.avatar || session?.user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.user_metadata?.full_name || "User")}&background=random`) 
                          : (msg?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg?.user_name || "User")}&background=random`)
                        } 
                        alt="avatar" 
                        className={`w-8 h-8 rounded-full neo-avatar ${isCurrentUser ? "ml-2" : "mr-2"}`} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(isCurrentUser ? session?.user?.user_metadata?.full_name : msg?.user_name || "User")}&background=random`;
                        }}
                      />
                      
                      {/* Message container */}
                      <div 
                        className={`py-2 px-3 neo-message ${isCurrentUser 
                          ? "neo-message-own" 
                          : "neo-message-other"}`}
                      >
                        <p>{msg.message}</p>
                      </div>
                    </div>
                    
                    {/* Timestamp */}
                    <span className={`text-xs neo-timestamp mt-1 ${isCurrentUser ? "text-right mr-10" : "text-left ml-10"}`}>
                      {formattedTime}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {/**message input */}
          <form
            onSubmit={sendMessage}
            className="flex flex-col sm:flex-row p-4 border-t-[1px] border-gray-700 chat-form"
          >
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              type="text"
              placeholder="Type a message..."
              className="p-2 w-full neo-input"
            />
            <button className="mt-4 sm:mt-0 sm:ml-8 neo-button max-h-12">
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
