import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import './App.css';

// 1. Inicializar credenciales desde el archivo .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // 2. Persistencia en localStorage
  useEffect(() => {
    const savedChat = localStorage.getItem('nexus_chat_history');
    if (savedChat) {
      setMessages(JSON.parse(savedChat));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Lógica de Envío e IA
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Configuración del modelo y System Instruction
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        systemInstruction: 'Eres Nexus AI, un asistente técnico experto. Responde usando Markdown',
      });

      const result = await model.generateContent(userMessage.content);
      const aiResponseText = result.response.text();
      
      const aiMessage = { role: 'ai', content: aiResponseText };
      setMessages(prev => [...prev, aiMessage]);

      // 4. Guardar en Supabase (Tabla: conversaciones)
      const { error } = await supabase
        .from('conversaciones')
        .insert([{ pregunta: userMessage.content, respuesta: aiResponseText }]);

      if (error) console.error("Error guardando en Supabase:", error);

    } catch (error) {
      console.error("Error al conectar con Gemini:", error);
      setMessages(prev => [...prev, { role: 'ai', content: '**Error de conexión.** Verifica tus credenciales en el archivo .env.local.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Funciones Pro: Micrófono (Web Speech API)
  const toggleMic = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta el reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + " " + transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    }
  };

  // Funciones Pro: Copiar al portapapeles
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("¡Respuesta copiada!");
  };

  const startNewChat = () => setMessages([]);
  
  const clearSession = () => {
    localStorage.removeItem('nexus_chat_history');
    setMessages([]);
  };

  return (
    <div className="app-container">
      {/* Barra Lateral */}
      <aside className="sidebar">
        <h2>Nexus AI Chat</h2>
        <button onClick={startNewChat}>+ Nuevo Chat</button>
        <button className="btn-danger" onClick={clearSession}>Borrar sesión</button>
      </aside>

      {/* Área Principal */}
      <main className="chat-area">
        <div className="messages-container">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === 'ai' && (
                <button className="copy-btn" onClick={() => copyToClipboard(msg.content)}>
                  📋 Copiar
                </button>
              )}
              {msg.role === 'ai' ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          ))}
          {isLoading && <div className="message ai">Pensando...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <button 
            className={`btn-mic ${isListening ? 'listening' : ''}`} 
            onClick={toggleMic}
            title="Dictar por voz"
          >
            🎙️
          </button>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pregúntale a Nexus AI..."
            disabled={isLoading}
          />
          <button className="btn-primary" onClick={handleSend} disabled={isLoading}>
            Enviar
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;