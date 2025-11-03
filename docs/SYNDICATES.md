# Syndicate Features

## Overview
Syndicates allow users to pool their lottery tickets together to support social causes while increasing their chances of winning. Users can choose between different governance models: Leader-guided (faster decision-making, higher risk) or DAO-governed (slower consensus-based decisions, higher security).

## Key Components

### 1. SyndicateCard
Displays syndicate information with:
- Cause and description
- Governance model indicator (Leader/DAO/Hybrid)
- Member count and impact metrics
- Recent activity feed
- Social sharing options

### 2. SocialFeed
Shows real-time community activity:
- New members joining
- Tickets purchased
- Wins and donations
- Trending syndicates
- Governance activity (for DAO-governed syndicates)

### 3. Purchase Flow
Enhanced modal with syndicate mode:
- Choose between individual or syndicate purchase
- Select specific syndicate to support
- View governance model information
- View impact preview before purchase
- Configure governance parameters (for hybrid syndicates)

### 4. Syndicate Detail Page
Dedicated page for each syndicate showing:
- Detailed impact metrics
- Complete activity history
- Member statistics
- Governance model details and history
- Social sharing

## API Endpoints
- `GET /api/syndicates` - Returns list of active syndicates with rich data including governance model

## Core Types
- `SyndicateInfo` - Main syndicate data structure with governance model
- `SyndicateActivity` - Activity events (joins, tickets, wins, donations)
- `SyndicateImpact` - Impact calculations for purchases
- `GovernanceAction` - Governance actions and voting history