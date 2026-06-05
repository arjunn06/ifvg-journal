# Trade Journal API Documentation

## Table of Contents
1. [Getting Started](#getting-started)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Webhook Actions](#webhook-actions)
5. [Response Format](#response-format)
6. [Error Codes](#error-codes)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

---

## Getting Started

The Trade Journal API provides webhook endpoints for managing trading accounts, trades, and related data through external integrations like Zoho Guided Conversations.

### Base URL
```
https://dynibyqrcbxneiwjyahn.functions.supabase.co
```

### Supported Content Types
- `application/json`
- `application/x-www-form-urlencoded`

---

## Authentication

### Method 1: JWT Bearer Token (Recommended)
```http
Authorization: Bearer <your-jwt-token>
```

### Method 2: Email-based Authentication (For External Integrations)
Include user email in request body or query parameters:
```json
{
  "user_email": "user@example.com"
}
```

---

## Webhook Actions

### 1. Get Trading Accounts

Retrieves active trading accounts for the authenticated user.

**Endpoint:** `GET /get-trading-accounts`

**Parameters:**
- `user_email` (string, optional): User's email address

**Response:**
```json
{
  "account_1": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Trading Account"
  },
  "account_2": {
    "id": "987fcdeb-51a2-43d1-b789-123456789abc",
    "name": "Prop Firm Account"
  }
}
```

---

### 2. Main Webhook Handler

**Endpoint:** `POST /zoho-webhook`

All trading operations are handled through this main webhook endpoint using the `action` parameter.

#### 2.1 Select Account

**Action:** `select_account`

**Request Body:**
```json
{
  "action": "select_account",
  "user_email": "user@example.com",
  "account_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account selected successfully",
  "data": {
    "account_id": "123e4567-e89b-12d3-a456-426614174000",
    "account_name": "My Trading Account"
  },
  "chatbot_message": "Great! You've selected 'My Trading Account'. What would you like to do next?"
}
```

#### 2.2 Create Trade

**Action:** `create_trade`

**Request Body:**
```json
{
  "action": "create_trade",
  "user_email": "user@example.com",
  "account_id": "123e4567-e89b-12d3-a456-426614174000",
  "symbol": "EURUSD",
  "trade_type": "buy",
  "entry_price": 1.0850,
  "quantity": 1.0,
  "stop_loss": 1.0800,
  "take_profit": 1.0900,
  "entry_date": "2024-01-15T10:30:00Z",
  "notes": "Bullish trend continuation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trade created successfully",
  "data": {
    "trade_id": "456e7890-e12b-34c5-d678-901234567890",
    "symbol": "EURUSD",
    "entry_price": 1.0850,
    "status": "open"
  },
  "chatbot_message": "✅ Trade created successfully!\n\n📊 **EURUSD BUY**\n💰 Entry: 1.0850\n🛑 Stop Loss: 1.0800\n🎯 Take Profit: 1.0900\n📝 Notes: Bullish trend continuation"
}
```

#### 2.3 Update Trade

**Action:** `update_trade`

**Request Body:**
```json
{
  "action": "update_trade",
  "user_email": "user@example.com",
  "trade_id": "456e7890-e12b-34c5-d678-901234567890",
  "exit_price": 1.0875,
  "exit_date": "2024-01-15T15:45:00Z",
  "notes": "Partial profit taken at resistance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trade updated successfully",
  "data": {
    "trade_id": "456e7890-e12b-34c5-d678-901234567890",
    "symbol": "EURUSD",
    "pnl": 25.00,
    "status": "updated"
  },
  "chatbot_message": "✅ Trade updated successfully!\n\n📊 **EURUSD** - P&L: +$25.00\n📝 Updated notes: Partial profit taken at resistance"
}
```

#### 2.4 Close Trade

**Action:** `close_trade`

**Request Body:**
```json
{
  "action": "close_trade",
  "user_email": "user@example.com",
  "trade_id": "456e7890-e12b-34c5-d678-901234567890",
  "exit_price": 1.0890,
  "exit_date": "2024-01-15T16:00:00Z",
  "notes": "Target reached"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trade closed successfully",
  "data": {
    "trade_id": "456e7890-e12b-34c5-d678-901234567890",
    "symbol": "EURUSD",
    "pnl": 40.00,
    "status": "closed"
  },
  "chatbot_message": "🎉 Trade closed successfully!\n\n📊 **EURUSD BUY** - CLOSED\n💰 Final P&L: +$40.00\n📈 Well done! Target reached."
}
```

#### 2.5 Get Account Summary

**Action:** `get_account_summary`

**Request Body:**
```json
{
  "action": "get_account_summary",
  "user_email": "user@example.com",
  "account_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account summary retrieved",
  "data": {
    "account_name": "My Trading Account",
    "current_balance": 10250.00,
    "current_equity": 10180.00,
    "total_trades": 45,
    "winning_trades": 28,
    "losing_trades": 17,
    "win_rate": 62.22,
    "total_pnl": 1250.00
  },
  "chatbot_message": "📊 **Account Summary: My Trading Account**\n\n💰 Balance: $10,250.00\n📈 Equity: $10,180.00\n🎯 Total Trades: 45\n✅ Win Rate: 62.22%\n📊 Total P&L: +$1,250.00"
}
```

#### 2.6 Get Quick Templates

**Action:** `get_quick_templates`

**Request Body:**
```json
{
  "action": "get_quick_templates",
  "user_email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quick templates retrieved",
  "data": {
    "templates": [
      {
        "name": "Scalp Trade",
        "symbol": "EURUSD",
        "trade_type": "buy",
        "quantity": 0.1
      },
      {
        "name": "Swing Trade",
        "symbol": "GBPUSD",
        "trade_type": "sell",
        "quantity": 0.5
      }
    ]
  },
  "chatbot_message": "📋 **Quick Templates Available:**\n\n1️⃣ **Scalp Trade** - EURUSD BUY (0.1 lots)\n2️⃣ **Swing Trade** - GBPUSD SELL (0.5 lots)\n\nSelect a template to create a trade quickly!"
}
```

---

## Response Format

All API responses follow a consistent structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data specific to the action
  },
  "chatbot_message": "User-friendly message for chat interfaces"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "error_code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_ACTION` | 400 | The specified action is not supported |
| `MISSING_REQUIRED_FIELD` | 400 | A required field is missing from the request |
| `INVALID_USER_EMAIL` | 400 | The provided email address is invalid |
| `USER_NOT_FOUND` | 404 | User not found for the provided email |
| `ACCOUNT_NOT_FOUND` | 404 | Trading account not found |
| `TRADE_NOT_FOUND` | 404 | Trade not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `DATABASE_ERROR` | 500 | Database operation failed |

### Detailed Error Examples

#### Missing Required Field
```json
{
  "success": false,
  "error": "Missing required field: symbol",
  "error_code": "MISSING_REQUIRED_FIELD",
  "details": {
    "field": "symbol",
    "message": "Symbol is required for creating a trade"
  }
}
```

#### Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "details": {
    "field": "entry_price",
    "message": "Entry price must be a positive number"
  }
}
```

#### User Not Found
```json
{
  "success": false,
  "error": "User not found for provided email",
  "error_code": "USER_NOT_FOUND",
  "details": {
    "email": "user@example.com"
  }
}
```

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Rate Limit:** 100 requests per minute per user
- **Rate Limit Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when rate limit resets

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset_time": "2024-01-15T11:00:00Z"
  }
}
```

---

## Examples

### Example 1: Creating a Trade via Webhook

**Request:**
```bash
curl -X POST https://dynibyqrcbxneiwjyahn.functions.supabase.co/zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_trade",
    "user_email": "trader@example.com",
    "account_id": "123e4567-e89b-12d3-a456-426614174000",
    "symbol": "GBPUSD",
    "trade_type": "sell",
    "entry_price": 1.2650,
    "quantity": 0.5,
    "stop_loss": 1.2700,
    "take_profit": 1.2600,
    "entry_date": "2024-01-15T14:30:00Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Trade created successfully",
  "data": {
    "trade_id": "789e0123-f45g-67h8-i901-234567890abc",
    "symbol": "GBPUSD",
    "entry_price": 1.2650,
    "status": "open"
  },
  "chatbot_message": "✅ Trade created successfully!\n\n📊 **GBPUSD SELL**\n💰 Entry: 1.2650\n🛑 Stop Loss: 1.2700\n🎯 Take Profit: 1.2600"
}
```

### Example 2: Getting Account Summary

**Request:**
```bash
curl -X POST https://dynibyqrcbxneiwjyahn.functions.supabase.co/zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_account_summary",
    "user_email": "trader@example.com",
    "account_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Account summary retrieved",
  "data": {
    "account_name": "My Trading Account",
    "current_balance": 10250.00,
    "current_equity": 10180.00,
    "total_trades": 45,
    "winning_trades": 28,
    "losing_trades": 17,
    "win_rate": 62.22,
    "total_pnl": 1250.00
  },
  "chatbot_message": "📊 **Account Summary: My Trading Account**\n\n💰 Balance: $10,250.00\n📈 Equity: $10,180.00\n🎯 Total Trades: 45\n✅ Win Rate: 62.22%\n📊 Total P&L: +$1,250.00"
}
```

### Example 3: Error Handling

**Request with Missing Field:**
```bash
curl -X POST https://dynibyqrcbxneiwjyahn.functions.supabase.co/zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_trade",
    "user_email": "trader@example.com",
    "account_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Error Response:**
```json
{
  "success": false,
  "error": "Missing required field: symbol",
  "error_code": "MISSING_REQUIRED_FIELD",
  "details": {
    "field": "symbol",
    "message": "Symbol is required for creating a trade"
  }
}
```

---

## Additional Resources

- [Zoho GC Integration Guide](./zoho-gc-integration.md)
- [Authentication Setup](./authentication.md)
- [Webhook Testing Tools](./testing.md)

---

## Support

For technical support or questions about the API:
- Email: support@example.com
- Documentation: [API Docs](./api-documentation.md)
- Status Page: [System Status](./status.md)

---

*Last Updated: January 2024*