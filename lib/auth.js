import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectDB from './mongodb';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Initialize default users if they don't exist
 */
export async function initializeUsers() {
  await connectDB();

  // Check if users exist
  const existingUser = await User.findOne({ username: 'user' });
  const existingAdmin = await User.findOne({ username: 'admin' });

  // Create user if doesn't exist
  if (!existingUser && USER_PASSWORD) {
    const hashedUserPassword = await bcrypt.hash(USER_PASSWORD, 10);
    await User.create({
      username: 'user',
      password: hashedUserPassword,
      role: 'user',
    });
  }

  // Create admin if doesn't exist
  if (!existingAdmin && ADMIN_PASSWORD) {
    const hashedAdminPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      username: 'admin',
      password: hashedAdminPassword,
      role: 'admin',
    });
  }
}

/**
 * Verify user credentials
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, token?: string}>}
 */
export async function verifyCredentials(username, password) {
  await connectDB();

  const user = await User.findOne({ username });
  if (!user) {
    return { success: false, message: 'Invalid credentials' };
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return { success: false, message: 'Invalid credentials' };
  }

  const token = jwt.sign(
    { userId: user._id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    success: true,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
    },
    token,
  };
}

/**
 * Verify JWT token
 * @param {string} token
 * @returns {Promise<{success: boolean, user?: object}>}
 */
export async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      success: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      },
    };
  } catch (error) {
    return { success: false, message: 'Invalid token' };
  }
}

/**
 * Middleware to check authentication
 * @param {Request} req
 * @returns {Promise<{authenticated: boolean, user?: object}>}
 */
export async function requireAuth(req) {
  // Extract token from Authorization header
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || authHeader;

  if (!token) {
    return { authenticated: false, message: 'No token provided' };
  }

  const verification = await verifyToken(token);
  if (!verification.success) {
    return { authenticated: false, message: verification.message };
  }

  return { authenticated: true, user: verification.user };
}

/**
 * Middleware to check admin role
 * @param {Request} req
 * @returns {Promise<{authenticated: boolean, isAdmin: boolean, user?: object}>}
 */
export async function requireAdmin(req) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return { authenticated: false, isAdmin: false, message: auth.message };
  }

  if (auth.user.role !== 'admin') {
    return { authenticated: true, isAdmin: false, message: 'Admin access required' };
  }

  return { authenticated: true, isAdmin: true, user: auth.user };
}

