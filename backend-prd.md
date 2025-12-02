# Product Requirements Document (PRD) - RCCG R63 Teens Backend

## 1. Overview

### 1.1 Project Description
The RCCG R63 Teens Backend is a comprehensive API service that supports the RCCG R63 Teens event registration and ticketing system. This backend will replace the current mock data implementation in the React frontend, providing real database persistence, authentication, and business logic for managing teen registrations, coordinator operations, and administrative functions.

### 1.2 Business Context
RCCG R63 Teens is a youth ministry program within the Redeemed Christian Church of God (RCCG) Region 63. The system manages event registrations for teens and pre-teens, including personal information, medical details, emergency contacts, and church hierarchy data. Coordinators from different provinces manage registrations, while administrators oversee the entire system.

### 1.3 Current State
- Frontend: React application with TypeScript, using mock data and local storage
- Authentication: Mock authentication with hardcoded credentials
- Data: In-memory mock data with simulated API delays
- Features: Ticket registration, bulk operations, QR codes, PDF generation, email services

## 2. Objectives

### 2.1 Primary Goals
- Provide secure, scalable API endpoints for all frontend operations
- Implement robust authentication and role-based authorization
- Ensure data persistence and integrity
- Support bulk operations for efficient coordinator workflows
- Enable real-time status updates and notifications

### 2.2 Success Criteria
- 99.9% uptime for API services
- Response times under 500ms for standard operations
- Support for 10,000+ concurrent registrations during peak periods
- Secure handling of sensitive medical and personal data
- Seamless integration with existing frontend

## 3. Features and Requirements

### 3.1 Core Features

#### 3.1.1 Authentication & Authorization
- **User Roles**: Admin, Coordinator (province-specific)
- **Login System**: Username/password authentication
- **Session Management**: JWT-based sessions with refresh tokens
- **Role-based Access**: Coordinators can only access their province's data

#### 3.1.2 Ticket Management
- **Single Registration**: Individual ticket creation with validation
- **Bulk Registration**: CSV upload and batch processing
- **Status Management**: Pending → Approved/Rejected workflow
- **Ticket Retrieval**: By ID, status, province, or coordinator
- **Update Operations**: Modify ticket details and status

#### 3.1.3 Data Validation
- **Schema Validation**: Comprehensive validation for all ticket fields
- **Business Rules**: Age restrictions, required fields based on category
- **Duplicate Prevention**: Check for duplicate registrations
- **Data Integrity**: Ensure consistency across related fields

#### 3.1.4 Reporting & Analytics
- **Dashboard Data**: Statistics for coordinators and admins
- **Export Capabilities**: CSV/PDF reports by province/status
- **Real-time Counts**: Live registration statistics

### 3.2 Technical Requirements

#### 3.2.1 Performance
- API response time: <500ms for 95% of requests
- Concurrent users: Support 1000+ simultaneous connections
- Database queries: Optimized with proper indexing
- Caching: Implement Redis for frequently accessed data

#### 3.2.2 Security
- **Data Encryption**: Encrypt sensitive fields (medical info, contacts)
- **Input Sanitization**: Prevent SQL injection and XSS attacks
- **Rate Limiting**: Implement API rate limiting
- **Audit Logging**: Track all data modifications
- **GDPR Compliance**: Data protection and privacy controls

#### 3.2.3 Scalability
- **Horizontal Scaling**: Stateless API design
- **Database Sharding**: Support for data partitioning
- **CDN Integration**: For static assets and file uploads
- **Load Balancing**: Distribute traffic across multiple instances

## 4. API Design

### 4.1 Authentication Endpoints

```
POST /api/auth/login
- Body: { username, password }
- Response: { token, refreshToken, user }

POST /api/auth/refresh
- Headers: Authorization: Bearer <refreshToken>
- Response: { token, user }

POST /api/auth/logout
- Headers: Authorization: Bearer <token>
```

### 4.2 Ticket Endpoints

```
GET /api/tickets
- Query params: status, province, page, limit
- Response: { tickets: [], total, page, limit }

GET /api/tickets/:ticketId
- Response: { ticket }

POST /api/tickets
- Body: Ticket data (without id, status, registeredAt)
- Response: { ticket, success: true }

PUT /api/tickets/:id/status
- Body: { status: 'approved' | 'rejected' | 'pending' }
- Response: { ticket }

POST /api/tickets/bulk
- Body: { tickets: [] }
- Response: { results: OperationResult }
```

### 4.3 Coordinator Endpoints

```
GET /api/coordinators/dashboard
- Response: { stats: {}, recentTickets: [] }

GET /api/coordinators/tickets
- Query params: status, page, limit
- Response: { tickets: [], total }
```

### 4.4 Admin Endpoints

```
GET /api/admin/dashboard
- Response: { globalStats: {}, provinceStats: [] }

GET /api/admin/tickets
- Query params: province, status, page, limit
- Response: { tickets: [], total }

POST /api/admin/coordinators
- Body: { username, province, name }
- Response: { coordinator }
```

## 5. Database Schema

### 5.1 Tables

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'coordinator')),
  province VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tickets Table
```sql
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 8 AND age <= 19),
  category VARCHAR(50) NOT NULL CHECK (category IN ('pre_teens', 'teens')),
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female')),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  province VARCHAR(255) NOT NULL,
  zone VARCHAR(255) NOT NULL,
  area VARCHAR(255) NOT NULL,
  parish VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  medical_conditions TEXT,
  medications TEXT,
  dietary_restrictions TEXT,
  emergency_contact VARCHAR(255) NOT NULL,
  emergency_phone VARCHAR(20) NOT NULL,
  emergency_relationship VARCHAR(100) NOT NULL,
  parent_name VARCHAR(255) NOT NULL,
  parent_email VARCHAR(255) NOT NULL,
  parent_phone VARCHAR(20) NOT NULL,
  parent_relationship VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  registered_at TIMESTAMP DEFAULT NOW(),
  registered_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Audit Log Table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 6. Technology Stack

### 6.1 Backend Framework
- **Language**: Node.js with TypeScript
- **Framework**: Express.js or Fastify
- **ORM**: Prisma or TypeORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **File Storage**: AWS S3 or similar for bulk uploads

### 6.2 Security & Authentication
- **JWT**: jsonwebtoken library
- **Password Hashing**: bcrypt
- **Rate Limiting**: express-rate-limit
- **CORS**: cors middleware
- **Helmet**: Security headers

### 6.3 Additional Services
- **Email Service**: SendGrid or AWS SES for notifications
- **PDF Generation**: Puppeteer or similar for ticket PDFs
- **QR Code Generation**: qrcode library
- **CSV Processing**: csv-parser for bulk uploads

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up project structure and dependencies
- Implement database schema and migrations
- Basic authentication system
- User management endpoints

### Phase 2: Core API (Week 3-4)
- Ticket CRUD operations
- Validation middleware
- Role-based authorization
- Basic dashboard endpoints

### Phase 3: Advanced Features (Week 5-6)
- Bulk operations
- File upload handling
- Audit logging
- Email notifications

### Phase 4: Integration & Testing (Week 7-8)
- Frontend integration
- Comprehensive testing
- Performance optimization
- Security audit

## 8. Testing Strategy

### 8.1 Unit Tests
- Service layer functions
- Validation logic
- Authentication utilities

### 8.2 Integration Tests
- API endpoints
- Database operations
- External service integrations

### 8.3 End-to-End Tests
- Complete user workflows
- Bulk operations
- Authentication flows

### 8.4 Performance Tests
- Load testing with 1000+ concurrent users
- Database query optimization
- API response time validation

## 9. Deployment & DevOps

### 9.1 Infrastructure
- **Cloud Provider**: AWS/GCP/Azure
- **Containerization**: Docker
- **Orchestration**: Kubernetes or Docker Compose for development
- **Database**: Managed PostgreSQL instance
- **Cache**: Redis cluster

### 9.2 CI/CD Pipeline
- **Version Control**: Git with GitHub
- **CI/CD**: GitHub Actions
- **Testing**: Automated test runs on PRs
- **Deployment**: Blue-green deployment strategy
- **Monitoring**: Application performance monitoring

### 9.3 Monitoring & Logging
- **Application Monitoring**: New Relic or DataDog
- **Error Tracking**: Sentry
- **Log Aggregation**: ELK stack or CloudWatch
- **Database Monitoring**: Query performance and connection pooling

## 10. Risk Assessment & Mitigation

### 10.1 Technical Risks
- **Data Loss**: Regular backups and replication
- **Performance Issues**: Caching and database optimization
- **Security Vulnerabilities**: Regular security audits and updates

### 10.2 Business Risks
- **Low Adoption**: User training and support
- **Data Privacy Issues**: Compliance with data protection regulations
- **System Downtime**: Redundant infrastructure and failover systems

## 11. Success Metrics

### 11.1 Technical Metrics
- API uptime: >99.9%
- Average response time: <300ms
- Error rate: <0.1%
- Concurrent users supported: 2000+

### 11.2 Business Metrics
- Registration completion rate: >95%
- Coordinator satisfaction: >90%
- Admin efficiency improvement: >50%
- Data accuracy: >99%

## 12. Future Enhancements

### 12.1 Phase 2 Features
- Mobile app API support
- Advanced reporting and analytics
- Integration with church management systems
- Real-time notifications via WebSocket

### 12.2 Scalability Improvements
- Multi-region deployment
- Advanced caching strategies
- Machine learning for duplicate detection
- Automated scaling based on load

---

*This PRD serves as a comprehensive guide for developing the RCCG R63 Teens backend. Regular reviews and updates will ensure alignment with evolving requirements and best practices.*
