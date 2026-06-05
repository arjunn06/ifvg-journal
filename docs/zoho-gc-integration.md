# Enhanced Zoho Guided Conversations (GC) Integration for Interactive Trade Journaling

This integration provides a comprehensive interactive trade journaling experience through Zoho Desk Guided Conversations chatbot using webhook blocks. Users can authenticate, select trading accounts, create/manage trades, and get performance insights through natural conversation.

## Overview

The integration supports:
- **Authentication**: Email-based user verification  
- **Account Selection**: Dynamic buttons for trading account selection
- **Session Management**: Maintains conversation state across interactions
- **Trade Management**: Full CRUD operations on trades
- **Performance Analytics**: Account summaries and trading statistics
- **Quick Templates**: Personalized trade templates based on history

## Webhook Endpoint

**URL**: `https://dynibyqrcbxneiwjyahn.functions.supabase.co/zoho-webhook`
**Method**: POST
**Authentication**: None (public endpoint, validates by email)

## Enhanced Actions Reference

### 1. Get Trading Accounts (with Dynamic Buttons)
Retrieves user's accounts formatted for GC dynamic button selection.

**Request:**
```json
{
  "action": "get_trading_accounts",
  "user_email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "accounts": [{"id": "uuid", "name": "Live Account", "broker": "MT5", "currency": "USD", "current_balance": 10000}],
  "gc_buttons": [
    {
      "text": "Live Account - MT5 (USD10000)",
      "value": "account-uuid",
      "action": "select_account"
    }
  ],
  "chatbot_message": "Please select which trading account you want to use for journaling:",
  "next_action": "account_selection"
}
```

### 2. Select Account (Session Start)
Establishes session with selected account and provides quick actions.

**Request:**
```json
{
  "action": "select_account",
  "user_email": "user@example.com",
  "selected_account_id": "account-uuid",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "selected_account": {"id": "uuid", "name": "Live Account", "broker": "MT5"},
  "session_id": "session-uuid",
  "chatbot_message": "Perfect! You've selected 'Live Account' (MT5) with USD10000. Now you can start journaling your trades...",
  "quick_actions": [
    {"text": "📝 Create New Trade", "action": "create_trade_wizard"},
    {"text": "📊 Recent Trades", "action": "get_recent_trades"},
    {"text": "🔍 Search Trades", "action": "search_trades_prompt"},
    {"text": "📈 Account Summary", "action": "get_account_summary"}
  ]
}
```

### 3. Create Trade (Enhanced)
Creates trade with session-selected account.

**Request:**
```json
{
  "action": "create_trade",
  "user_email": "user@example.com",
  "selected_account_id": "account-uuid",
  "trade_data": {
    "symbol": "EURUSD",
    "trade_type": "buy",
    "entry_price": 1.0850,
    "quantity": 100000,
    "strategy_name": "Breakout Strategy",
    "stop_loss": 1.0800,
    "take_profit": 1.0900,
    "notes": "Strong breakout above resistance",
    "emotions": "Confident"
  }
}
```

### 4. Update Trade
Updates an existing trade with new information.

**Request:**
```json
{
  "action": "update_trade",
  "user_email": "user@example.com",
  "trade_id": "trade-uuid",
  "update_data": {
    "stop_loss": 1.0820,
    "take_profit": 1.0950,
    "notes": "Updated stop loss for better risk management",
    "emotions": "Cautious"
  }
}
```

### 5. Close Trade
Closes a trade with exit details and automatic P&L calculation.

**Request:**
```json
{
  "action": "close_trade",
  "user_email": "user@example.com",
  "trade_id": "trade-uuid",
  "update_data": {
    "exit_price": 1.0890,
    "exit_date": "2025-01-01T15:30:00Z",
    "notes": "Target reached",
    "emotions": "Satisfied"
  }
}
```

**Response:**
```json
{
  "success": true,
  "trade": {"id": "uuid", "status": "closed", "pnl": 400.00},
  "chatbot_message": "🏁 Successfully closed your EURUSD buy trade at 1.0890. 🟢 Profit: +$400.00 The trade has been updated in your journal."
}
```

### 6. Get Account Summary
Provides comprehensive account performance overview.

**Request:**
```json
{
  "action": "get_account_summary",
  "user_email": "user@example.com",
  "selected_account_id": "account-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "account_summary": {
    "account": {"name": "Live Account", "current_balance": 10500, "currency": "USD"},
    "stats": {
      "total_trades": 25,
      "open_trades": 3,
      "closed_trades": 22,
      "winning_trades": 15,
      "losing_trades": 7,
      "win_rate": 68.2,
      "total_pnl": 1500.50,
      "net_roi": 5.0
    }
  },
  "chatbot_message": "📊 **Live Account** Summary (MT5)\n💰 Balance: USD10500 | Equity: USD10800\n📈 Net ROI: 5.0% | Total P&L: +1500.50\n📝 Trades: 25 total (3 open, 22 closed)\n🎯 Win Rate: 68.2% (15W / 7L)"
}
```

### 7. Get Quick Templates
Returns personalized trade templates based on user history.

**Request:**
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
  "templates": {
    "popular_symbols": ["EURUSD", "GBPUSD", "USDJPY"],
    "strategies": [{"name": "Breakout Strategy", "risk_per_trade": 2.0}],
    "quick_actions": [
      {"text": "🚀 Scalp Trade", "symbol": "EURUSD", "quantity": 10000},
      {"text": "📈 Swing Position", "symbol": "GBPUSD", "quantity": 50000}
    ]
  },
  "chatbot_message": "Here are your quick trade templates based on your trading history:\n📊 Most traded: EURUSD, GBPUSD, USDJPY\n🎯 Active strategies: Breakout Strategy"
}
```

### 8. Search Trades & Get Recent Trades
(Same as before, but now work with selected account context)

## Complete Zoho GC Setup Guide

### Flow Architecture

```
1. Welcome Message → 2. Email Collection → 3. Account Selection → 4. Main Menu → 5. Trade Actions
```

### Step-by-Step GC Configuration

#### 1. Initial Welcome Block
**Block Type**: Message Block
```
Welcome to your Interactive Trade Journal! 📊

I'll help you log trades, track performance, and manage your trading accounts through simple conversation.

To get started, I need to verify your account.
```

#### 2. Email Collection Block
**Block Type**: Email Block
- **Variable Name**: `user_email`
- **Validation**: Required
- **Message**: "Please provide your registered email address:"

#### 3. Account Selection Webhook
**Block Type**: Webhook Block
- **URL**: `https://dynibyqrcbxneiwjyahn.functions.supabase.co/zoho-webhook`
- **Method**: POST
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "action": "get_trading_accounts",
  "user_email": "${user_email}"
}
```
- **Response Mapping**:
  - **Success Condition**: `response.success == true`
  - **Button Generation**: Use `response.gc_buttons` for dynamic buttons
  - **Message**: Display `response.chatbot_message`

#### 4. Account Selection Handler
**Block Type**: Button Choice Block
- **Buttons**: Generated from webhook response `gc_buttons` array
- **Variable**: `selected_account_id` (captures button value)

#### 5. Session Establishment Webhook
**Block Type**: Webhook Block
**Request Body**:
```json
{
  "action": "select_account",
  "user_email": "${user_email}",
  "selected_account_id": "${selected_account_id}",
  "session_id": "${conversation_id}"
}
```

#### 6. Main Menu Block
**Block Type**: Quick Reply Block
Display `response.chatbot_message` and create quick reply buttons from `response.quick_actions`:
- 📝 Create New Trade
- 📊 Recent Trades  
- 🔍 Search Trades
- 📈 Account Summary

#### 7. Trade Creation Flow

**A. Trade Symbol Collection**
**Block Type**: Text Input Block
- **Variable**: `trade_symbol`
- **Validation**: Required, 3-8 characters
- **Message**: "What symbol do you want to trade? (e.g., EURUSD, AAPL)"

**B. Trade Type Selection**
**Block Type**: Button Choice Block
- **Buttons**: ["Buy", "Sell"]
- **Variable**: `trade_type`

**C. Entry Price Collection**
**Block Type**: Number Input Block
- **Variable**: `entry_price`
- **Message**: "What's your entry price?"

**D. Quantity Collection**
**Block Type**: Number Input Block
- **Variable**: `quantity`  
- **Message**: "What's your position size/quantity?"

**E. Trade Creation Webhook**
**Block Type**: Webhook Block
**Request Body**:
```json
{
  "action": "create_trade",
  "user_email": "${user_email}",
  "selected_account_id": "${selected_account_id}",
  "trade_data": {
    "symbol": "${trade_symbol}",
    "trade_type": "${trade_type}",
    "entry_price": ${entry_price},
    "quantity": ${quantity}
  }
}
```

#### 8. Recent Trades Flow
**Block Type**: Webhook Block
**Request Body**:
```json
{
  "action": "get_recent_trades",
  "user_email": "${user_email}"
}
```

#### 9. Search Trades Flow
**A. Search Query Collection**
**Block Type**: Text Input Block
- **Variable**: `search_query`
- **Message**: "What would you like to search for? (symbol, notes, etc.)"

**B. Search Webhook**
**Request Body**:
```json
{
  "action": "search_trades", 
  "user_email": "${user_email}",
  "query": "${search_query}"
}
```

#### 10. Account Summary Flow
**Block Type**: Webhook Block
**Request Body**:
```json
{
  "action": "get_account_summary",
  "user_email": "${user_email}",
  "selected_account_id": "${selected_account_id}"
}
```

### Advanced Features

#### Trade Management Commands
Users can say:
- "Close my EURUSD trade at 1.0890"
- "Update stop loss to 1.0820" 
- "Show my account summary"
- "Search for gold trades"

#### Error Handling Flows
- **User Not Found**: Redirect to registration
- **No Accounts**: Guide to account creation
- **Invalid Trade Data**: Request missing information

#### Response Processing
Always check `response.success` and display `response.chatbot_message` for user feedback.

### Testing Your Integration

1. **Test Email**: Use a registered user's email
2. **Test Account Selection**: Verify dynamic buttons appear
3. **Test Trade Creation**: Create a simple buy/sell trade
4. **Test Analytics**: Request account summary
5. **Test Error Cases**: Try invalid email/data

### Best Practices

1. **Always validate responses** before proceeding
2. **Store session variables** for context
3. **Use dynamic buttons** for better UX
4. **Implement fallback flows** for errors
5. **Test with real trading data** scenarios

This enhanced integration provides a complete interactive trading journal experience through natural conversation while maintaining data security and user session context.