import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error();
    }
    
    // Add user to request
    req.user = {
      id: user._id,
      username: user.username
    };
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

export default auth; 