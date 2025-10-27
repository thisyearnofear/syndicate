# Syndicate Features

## Overview
Syndicates allow users to pool their lottery tickets together to support social causes while increasing their chances of winning.

## Key Components

### 1. SyndicateCard
Displays syndicate information with:
- Cause and description
- Member count and impact metrics
- Recent activity feed
- Social sharing options

### 2. SocialFeed
Shows real-time community activity:
- New members joining
- Tickets purchased
- Wins and donations
- Trending syndicates

### 3. Purchase Flow
Enhanced modal with syndicate mode:
- Choose between individual or syndicate purchase
- Select specific syndicate to support
- View impact preview before purchase

### 4. Syndicate Detail Page
Dedicated page for each syndicate showing:
- Detailed impact metrics
- Complete activity history
- Member statistics
- Social sharing

## API Endpoints
- `GET /api/syndicates` - Returns list of active syndicates with rich data

## Core Types
- `SyndicateInfo` - Main syndicate data structure
- `SyndicateActivity` - Activity events (joins, tickets, wins, donations)
- `SyndicateImpact` - Impact calculations for purchases