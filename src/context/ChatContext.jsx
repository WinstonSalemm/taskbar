import { createContext, useContext, useState } from "react";

const ChatContext = createContext({
  chatTask: null,
  setChatTask: () => {},
});

export function ChatProvider({ children }) {
  const [chatTask, setChatTask] = useState(null);

  return (
    <ChatContext.Provider value={{ chatTask, setChatTask }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
