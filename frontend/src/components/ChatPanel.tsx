import { Box, VStack, Input, Button, Text, Flex } from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

interface ChatMessage {
  username: string;
  message: string;
  timestamp: Date;
}

const ChatPanel = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { connected } = useGame();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !connected) return;

    // Add message to local state (in real app, this would be handled by WebSocket)
    const message: ChatMessage = {
      username: 'You',
      message: newMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  return (
    <Box bg="gray.800" p={4} borderRadius="lg" height="300px" display="flex" flexDirection="column">
      <Text fontSize="lg" fontWeight="bold" mb={2}>
        Chat
      </Text>

      {/* Messages Area */}
      <Box
        flex="1"
        overflowY="auto"
        mb={4}
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'gray',
            borderRadius: '24px',
          },
        }}
      >
        <VStack align="stretch" spacing={2}>
          {messages.map((msg, index) => (
            <Box key={index} bg="gray.700" p={2} borderRadius="md">
              <Flex justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="bold" color="blue.300">
                  {msg.username}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </Text>
              </Flex>
              <Text fontSize="sm">{msg.message}</Text>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input Area */}
      <Flex>
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          mr={2}
          disabled={!connected}
        />
        <Button
          colorScheme="blue"
          onClick={handleSendMessage}
          disabled={!connected}
        >
          Send
        </Button>
      </Flex>
    </Box>
  );
};

export default ChatPanel; 