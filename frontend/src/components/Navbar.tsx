import { Box, Flex, Text, Button, HStack } from '@chakra-ui/react';
import { useGame } from '../context/GameContext';

const Navbar = () => {
  const { connected, walletBalance } = useGame();

  return (
    <Box bg="gray.800" px={4} py={2}>
      <Flex maxW="1400px" mx="auto" align="center" justify="space-between">
        <Text fontSize="xl" fontWeight="bold">
          Crypto Crash
        </Text>
        
        <HStack spacing={4}>
          <Flex align="center" gap={2}>
            <Box w={2} h={2} borderRadius="full" bg={connected ? "green.400" : "red.400"} />
            <Text fontSize="sm">{connected ? "Connected" : "Disconnected"}</Text>
          </Flex>
          
          <Text>Balance: ${walletBalance.toFixed(2)}</Text>
          
          <Button colorScheme="blue" size="sm">
            Login
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
};

export default Navbar; 