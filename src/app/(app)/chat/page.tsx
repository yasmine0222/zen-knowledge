import { ChatClient } from "./ChatClient";

export default function ChatPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Assistant documentaire</h1>
      <ChatClient />
    </div>
  );
}
