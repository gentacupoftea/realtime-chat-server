/**
 * Simplified Realtime Chat Server (without Redis)
 * WebSocket + Socket.io を使用したリアルタイムチャットサーバー
 */

const { Server } = require('socket.io');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class RealtimeChatServer extends EventEmitter {
  constructor(httpServer, config) {
    super();
    
    this.config = config;
    this.activeStreams = new Map();
    this.chatHistory = new Map(); // In-memory storage instead of Redis
    
    // Socket.io サーバー初期化
    this.io = new Server(httpServer, {
      cors: {
        origin: config.corsOrigin || '*',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    
    this.setupEventHandlers();
    
    console.log('✅ Realtime Chat Server initialized (without Redis)');
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // 認証チェック
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        socket.disconnect();
        return;
      }
      
      socket.userId = userId;
      
      // コンテキスト参加
      socket.on('join_context', async (context) => {
        try {
          const roomId = this.getContextRoomId(context);
          socket.join(roomId);
          socket.currentContext = context;
          
          // 履歴を取得して送信
          const history = await this.getChatHistory(context);
          socket.emit('history_loaded', history);
          
          console.log(`User ${userId} joined context: ${roomId}`);
        } catch (error) {
          console.error('Error joining context:', error);
          socket.emit('error', { message: 'Failed to join context' });
        }
      });
      
      // メッセージ送信
      socket.on('send_message', async (data) => {
        const streamController = new StreamController(socket.id);
        this.activeStreams.set(socket.id, streamController);
        
        try {
          await this.processMessage(socket, data, streamController);
        } catch (error) {
          console.error('Error processing message:', error);
          socket.emit('error', { message: 'Failed to process message' });
        } finally {
          this.activeStreams.delete(socket.id);
        }
      });
      
      // ストリーム中断
      socket.on('interrupt_stream', () => {
        const controller = this.activeStreams.get(socket.id);
        if (controller) {
          controller.interrupt();
          console.log(`Stream interrupted for ${socket.id}`);
        }
      });
      
      // 切断処理
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.activeStreams.delete(socket.id);
      });
    });
  }
  
  async processMessage(socket, data, controller) {
    const { content, context, includeThinking } = data;
    const messageId = this.generateMessageId();
    
    // 思考プロセス開始
    if (includeThinking) {
      socket.emit('thinking_update', {
        type: { icon: '🤔', label: '分析中' },
        stage: 'リクエストを理解しています',
        newStep: {
          description: 'ユーザーの質問を分析中...',
          timestamp: new Date(),
        },
      });
    }
    
    // メッセージを保存
    await this.saveMessage({
      id: messageId,
      role: 'user',
      content,
      context,
      userId: socket.userId,
      timestamp: new Date(),
    });
    
    // コンテキストとメッセージ履歴を準備
    const systemPrompt = await this.buildSystemPrompt(context);
    const chatHistory = await this.getChatHistory(context);
    
    // Orchestratorに処理を依頼（実際の実装では）
    // ここではデモ用のシミュレーション
    await this.simulateAIResponse(socket, messageId, content, controller, includeThinking);
  }
  
  async simulateAIResponse(socket, messageId, userContent, controller, includeThinking) {
    // デモ用のレスポンス生成
    const responses = {
      'hello': 'こんにちは！MultiLLM Systemのリアルタイムチャットへようこそ。何かお手伝いできることがありますか？',
      'help': '以下のようなことができます：\n\n1. **タスク管理**: プロジェクトやタスクの進捗管理\n2. **コード生成**: 様々なプログラミング言語でのコード作成\n3. **分析**: データ分析やパフォーマンス評価\n4. **質問応答**: 技術的な質問への回答\n\n何について知りたいですか？',
      'code': '```javascript\n// サンプルコード\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10)); // 55\n```',
      default: `「${userContent}」についてお答えします。\n\nこれはデモ応答です。実際のシステムでは、MultiLLM Orchestratorが適切なWorkerを選択し、より詳細で有用な回答を生成します。`
    };
    
    const responseKey = Object.keys(responses).find(key => 
      userContent.toLowerCase().includes(key)
    ) || 'default';
    
    const response = responses[responseKey];
    
    // 思考プロセスの更新
    if (includeThinking) {
      const thinkingSteps = [
        { desc: '関連情報を検索中...', delay: 500 },
        { desc: '最適な回答を構築中...', delay: 1000 },
        { desc: '内容を検証中...', delay: 1500 },
      ];
      
      for (const step of thinkingSteps) {
        if (controller.isInterrupted) break;
        
        await this.sleep(step.delay);
        socket.emit('thinking_update', {
          type: { icon: '🔍', label: '処理中' },
          stage: '応答生成',
          newStep: {
            description: step.desc,
            detail: `処理済み: ${response.length * Math.random()} 文字`,
            timestamp: new Date(),
          },
        });
      }
    }
    
    // ストリーミングレスポンス
    const chunks = this.splitIntoChunks(response, 20);
    
    for (let i = 0; i < chunks.length; i++) {
      if (controller.isInterrupted) break;
      
      await this.sleep(50); // ストリーミング効果
      
      socket.emit('message_chunk', {
        messageId,
        content: chunks[i],
        isComplete: i === chunks.length - 1,
      });
    }
    
    // メッセージを保存
    if (!controller.isInterrupted) {
      await this.saveMessage({
        id: messageId,
        role: 'assistant',
        content: response,
        context: socket.currentContext,
        timestamp: new Date(),
      });
    }
  }
  
  // ユーティリティメソッド
  getContextRoomId(context) {
    if (context.taskId) {
      return `task:${context.taskId}`;
    } else if (context.projectId) {
      return `project:${context.projectId}`;
    }
    return 'general';
  }
  
  generateMessageId() {
    return `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }
  
  async buildSystemPrompt(context) {
    let prompt = 'あなたはMultiLLM Systemの高度なAIアシスタントです。';
    
    if (context.projectId) {
      prompt += `\n現在のプロジェクト: ${context.projectName || context.projectId}`;
    }
    
    if (context.taskId) {
      prompt += `\n現在のタスク: ${context.taskName || context.taskId}`;
    }
    
    return prompt;
  }
  
  async getChatHistory(context, limit = 50) {
    const roomId = this.getContextRoomId(context);
    const history = this.chatHistory.get(roomId) || [];
    return history.slice(-limit);
  }
  
  async saveMessage(message) {
    const roomId = this.getContextRoomId(message.context || {});
    
    if (!this.chatHistory.has(roomId)) {
      this.chatHistory.set(roomId, []);
    }
    
    const history = this.chatHistory.get(roomId);
    history.push(message);
    
    // Keep only last 1000 messages
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
  
  splitIntoChunks(text, chunkSize) {
    const chunks = [];
    let currentChunk = '';
    
    for (let i = 0; i < text.length; i++) {
      currentChunk += text[i];
      
      if (currentChunk.length >= chunkSize || i === text.length - 1) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
    
    return chunks;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down chat server...');
    
    // 全ストリームを中断
    for (const [socketId, controller] of this.activeStreams) {
      controller.interrupt();
    }
    
    // Socket.io接続を閉じる
    await this.io.close();
    
    console.log('Chat server shut down');
  }
}

// ストリーム制御クラス
class StreamController {
  constructor(socketId) {
    this.socketId = socketId;
    this.interrupted = false;
  }
  
  interrupt() {
    this.interrupted = true;
  }
  
  get isInterrupted() {
    return this.interrupted;
  }
}

// エクスポート
module.exports = { RealtimeChatServer };

// スタンドアロン実行
if (require.main === module) {
  const http = require('http');
  const express = require('express');
  
  const app = express();
  const server = http.createServer(app);
  
  const chatServer = new RealtimeChatServer(server, {
    corsOrigin: ['http://localhost:3000', 'https://multillm-demo-2025.web.app'],
  });
  
  const PORT = process.env.PORT || 8080;
  
  server.listen(PORT, () => {
    console.log(`🚀 Realtime Chat Server running on port ${PORT}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await chatServer.shutdown();
    process.exit(0);
  });
}