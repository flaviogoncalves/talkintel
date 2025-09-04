import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

class AuthService {
  constructor(database) {
    this.db = database;
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  // Generate JWT token
  generateTokens(payload) {
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshExpiresIn
    });

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      console.log('✅ Token verified successfully for user:', decoded.email);
      return decoded;
    } catch (error) {
      console.log('❌ Token verification failed:', {
        error: error.name,
        message: error.message,
        tokenLength: token ? token.length : 0,
        secretLength: this.jwtSecret ? this.jwtSecret.length : 0
      });
      throw new Error(`Invalid token: ${error.name} - ${error.message}`);
    }
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Create company and admin user
  async createCompany(companyData, adminData) {
    return await this.db.transaction(async (connection) => {
      // Generate company ID and webhook endpoint
      const companyId = uuidv4();

      // Create company (no webhook endpoint at company level)
      await connection.execute(
        `INSERT INTO companies (id, name, domain, subscription_tier, settings) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          companyId,
          companyData.name,
          companyData.domain || null,
          companyData.subscriptionTier || 'basic',
          JSON.stringify(companyData.settings || {})
        ]
      );

      // Create admin user
      const userId = uuidv4();
      const hashedPassword = await this.hashPassword(adminData.password);

      await connection.execute(
        `INSERT INTO users (id, email, password_hash, name, company_id, role) 
         VALUES (?, ?, ?, ?, ?, 'admin')`,
        [userId, adminData.email, hashedPassword, adminData.name, companyId]
      );

      return {
        company: {
          id: companyId,
          name: companyData.name,
          subscriptionTier: companyData.subscriptionTier || 'basic'
        },
        user: {
          id: userId,
          email: adminData.email,
          name: adminData.name,
          role: 'admin'
        }
      };
    });
  }

  // Login user
  async login(email, password) {
    try {
      // Get user with company info
      const users = await this.db.query(
        `SELECT u.*, c.name as company_name, c.subscription_tier 
         FROM users u 
         JOIN companies c ON u.company_id = c.id 
         WHERE u.email = ? AND u.is_active = TRUE AND c.is_active = TRUE`,
        [email]
      );

      if (users.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = users[0];

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const payload = {
        userId: user.id,
        companyId: user.company_id,
        email: user.email,
        role: user.role
      };

      const { accessToken, refreshToken } = this.generateTokens(payload);

      // Store refresh token
      const refreshTokenId = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await this.db.query(
        `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
        [refreshTokenId, user.id, refreshToken, expiresAt]
      );

      // Update last login
      await this.db.query(
        `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
        [user.id]
      );

      // Return user info without password
      const { password_hash, ...userInfo } = user;

      return {
        user: userInfo,
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken);

      // Check if refresh token exists and is valid
      const tokens = await this.db.query(
        `SELECT rt.*, u.email, u.role, u.company_id 
         FROM refresh_tokens rt 
         JOIN users u ON rt.user_id = u.id 
         WHERE rt.token = ? AND rt.expires_at > NOW()`,
        [refreshToken]
      );

      if (tokens.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const tokenData = tokens[0];

      // Generate new access token
      const payload = {
        userId: tokenData.user_id,
        companyId: tokenData.company_id,
        email: tokenData.email,
        role: tokenData.role
      };

      const newAccessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn
      });

      return { accessToken: newAccessToken };

    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  // Logout user
  async logout(refreshToken) {
    try {
      await this.db.query(
        `DELETE FROM refresh_tokens WHERE token = ?`,
        [refreshToken]
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Middleware functions
export const authenticateToken = (authService) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();

    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  };
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const validateCompanyAccess = (authService) => {
  return async (req, res, next) => {
    try {
      const { companyId } = req.params;
      
      console.log('🔍 validateCompanyAccess DEBUG:');
      console.log('  - URL params companyId:', companyId);
      console.log('  - req.user:', req.user);
      console.log('  - req.user.companyId:', req.user.companyId);
      console.log('  - req.user.userId:', req.user.userId);
      
      // If no companyId in params, use user's company
      if (!companyId) {
        req.companyId = req.user.companyId;
        console.log('  - No companyId in params, using user company:', req.companyId);
        return next();
      }

      // Handle 'current' as special case - it means the user's own company
      const targetCompanyId = companyId === 'current' ? req.user.companyId : companyId;
      console.log('  - Target companyId resolved to:', targetCompanyId);

      // Check if user belongs to the requested company
      if (targetCompanyId !== req.user.companyId) {
        console.log('  - ACCESS DENIED: targetCompanyId !== req.user.companyId');
        console.log('  - targetCompanyId:', targetCompanyId);
        console.log('  - req.user.companyId:', req.user.companyId);
        return res.status(403).json({ error: 'Access denied to this company data' });
      }

      console.log('  - ✅ Access granted');
      req.companyId = targetCompanyId;
      next();

    } catch (error) {
      console.error('Company access validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export default AuthService;