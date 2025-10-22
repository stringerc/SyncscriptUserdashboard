# SyncScript Dashboard - Navigation Implementation Guide

## Overview
All buttons and interactive elements in the SyncScript Dashboard now have:
1. **Click handlers** - Navigate to configured URLs
2. **Data attributes** (`data-nav`) - Easy identification for testing/automation
3. **Centralized configuration** - All URLs in `/utils/navigation.ts`

---

## Quick Start - Linking Buttons to Your Sites

### Step 1: Open `/utils/navigation.ts`

This file contains ALL navigation URLs. Update them to point to your actual destinations:

```typescript
export const navigationLinks = {
  // Example: Change this
  sidebar: {
    dashboard: '/',  // ← Change to your dashboard URL
    tasks: '/tasks', // ← Change to your tasks page URL
    // ... etc
  },

  // External links (full URLs)
  external: {
    support: 'https://support.syncscript.com',     // ← Your support site
    documentation: 'https://docs.syncscript.com',  // ← Your docs site
    pricing: 'https://syncscript.com/pricing',     // ← Your pricing page
    signup: 'https://syncscript.com/signup',       // ← Your signup page
    login: 'https://syncscript.com/login',         // ← Your login page
  },
};
```

### Step 2: Choose Navigation Type

**For internal navigation (same site):**
```typescript
dashboard: '/dashboard',  // Relative path
```

**For external navigation (different site):**
```typescript
signup: 'https://yoursite.com/signup',  // Full URL
```

Then use:
```typescript
navigate(path);  // Internal navigation
navigateToExternal(url);  // External navigation (opens in new tab)
```

---

## All Interactive Elements with Data Attributes

### Sidebar Navigation
| Element | Data Attribute | Default URL |
|---------|---------------|-------------|
| Logo | `data-nav="logo"` | `/` |
| Dashboard | `data-nav="sidebar-dashboard"` | `/` |
| Tasks | `data-nav="sidebar-tasks"` | `/tasks` |
| Calendar | `data-nav="sidebar-calendar"` | `/calendar` |
| AI | `data-nav="sidebar-ai"` | `/ai` |
| Energy | `data-nav="sidebar-energy"` | `/energy` |
| Team | `data-nav="sidebar-team"` | `/team` |
| Analytics | `data-nav="sidebar-analytics"` | `/analytics` |
| Gaming | `data-nav="sidebar-gaming"` | `/gaming` |
| Integrations | `data-nav="sidebar-integrations"` | `/integrations` |
| Enterprise | `data-nav="sidebar-enterprise"` | `/enterprise` |
| Scripts & Templates | `data-nav="sidebar-scripts"` | `/scripts-templates` |
| All Features Menu | `data-nav="sidebar-allfeatures"` | `/all-features` |
| Settings | `data-nav="sidebar-settings"` | `/settings` |

### Header Elements
| Element | Data Attribute | Default URL |
|---------|---------------|-------------|
| Logo | `data-nav="header-logo"` | `/` |
| Search Input | `data-nav="search-input"` | `/search` |
| Conversation Extraction | `data-nav="conversation-extraction"` | `/conversation-extraction` |
| Notifications | `data-nav="notifications"` | `/notifications` |
| AI Insights Toggle | `data-nav="ai-insights-toggle"` | Toggles sidebar |
| Energy Mode Toggle | `data-nav="energy-mode-toggle"` | Toggles mode |
| User Profile | `data-nav="user-profile"` | `/profile` |

### Resource Hub Buttons
| Element | Data Attribute | Default URL |
|---------|---------------|-------------|
| Financial Health Card | `data-nav="financial-health"` | `/financial/health` |
| View Stats | `data-nav="view-stats"` | `/gamification/stats` |
| Leaderboard | `data-nav="leaderboard"` | `/gamification/leaderboard` |

### Notifications (4 items)
| Element | Data Attribute | Default URL |
|---------|---------------|-------------|
| Team Update | `data-nav="notification-team-update"` | `/notifications/team-update` |
| Budget Alert | `data-nav="notification-budget-alert"` | `/notifications/budget-alert` |
| Mention | `data-nav="notification-mention"` | `/notifications/mention` |
| Goal Progress | `data-nav="notification-goal"` | `/notifications/goal-progress` |

### Achievements (5 items)
| Element | Data Attribute | Default URL |
|---------|---------------|-------------|
| Early Bird | `data-nav="achievement-early-bird"` | `/achievements/early-bird` |
| Focus Master | `data-nav="achievement-focus"` | `/achievements/focus-master` |
| Task Streak | `data-nav="achievement-task"` | `/achievements/task-streak` |
| Budget Master | `data-nav="achievement-budget"` | `/achievements/budget-master` |
| Energy Champion | `data-nav="achievement-energy"` | `/achievements/energy-champion` |

---

## Using with Cursor (MCP Connection)

Since you're using Cursor with MCP, you can:

### 1. **Find elements by data attribute:**
```javascript
// In browser console or automation scripts
document.querySelector('[data-nav="view-stats"]').click();
```

### 2. **Test navigation without leaving Figma Make:**
All clicks will log to console (currently). To enable actual navigation, the links will work when you click them.

### 3. **Add custom navigation logic:**

Edit `/utils/navigation.ts` to add your own logic:

```typescript
export const navigate = (path: string, external = false) => {
  // Add analytics tracking
  console.log('Navigating to:', path);
  
  // Add custom logic here
  if (path.includes('/external/')) {
    window.open(path, '_blank');
  } else {
    window.location.href = path;
  }
};
```

---

## Example Use Cases

### Example 1: Link "View Stats" to External Analytics Dashboard
```typescript
// In /utils/navigation.ts
resources: {
  viewStats: 'https://analytics.yoursite.com/dashboard',
  // ...
}

// Then use navigateToExternal:
navigateToExternal(navigationLinks.resources.viewStats);
```

### Example 2: Link Tasks to Different App
```typescript
sidebar: {
  tasks: 'https://tasks.yourcompany.com',
  // ...
}
```

### Example 3: Add Sign Up / Login Buttons

If you want to add these buttons, edit any component:

```typescript
// In any component
import { navigationLinks, navigateToExternal } from '../utils/navigation';

// Add buttons
<button 
  onClick={() => navigateToExternal(navigationLinks.external.signup)}
  data-nav="signup-button"
  className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg"
>
  Sign Up Free
</button>

<button 
  onClick={() => navigateToExternal(navigationLinks.external.login)}
  data-nav="login-button"
  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
>
  Login
</button>
```

---

## For React Router (Future Enhancement)

If you want to use React Router instead of `window.location.href`:

### 1. Install React Router:
```bash
npm install react-router-dom
```

### 2. Update `/utils/navigation.ts`:
```typescript
import { useNavigate } from 'react-router-dom';

export const useAppNavigation = () => {
  const navigate = useNavigate();
  
  return {
    navigate: (path: string) => navigate(path),
    navigateExternal: (url: string) => window.open(url, '_blank'),
  };
};
```

### 3. Use in components:
```typescript
const { navigate } = useAppNavigation();
// Then use navigate() instead of window.location
```

---

## Testing Navigation

### In Browser Console:
```javascript
// Test if element exists
console.log(document.querySelector('[data-nav="view-stats"]'));

// Simulate click
document.querySelector('[data-nav="view-stats"]').click();

// Get all navigation elements
document.querySelectorAll('[data-nav]');
```

### With Cypress (if you add testing):
```javascript
cy.get('[data-nav="view-stats"]').click();
cy.url().should('include', '/gamification/stats');
```

---

## Summary

✅ **All interactive elements** have `data-nav` attributes
✅ **All URLs** are in `/utils/navigation.ts` (easy to update)
✅ **Click handlers** are attached to all buttons
✅ **Works in Cursor** - elements are easily identifiable
✅ **Ready for customization** - change URLs in one place

### Next Steps:
1. Open `/utils/navigation.ts`
2. Update URLs to your actual destinations
3. Test clicking buttons in the dashboard
4. Optionally add more buttons (Sign Up, Login, etc.)

---

Need help? The navigation system is fully functional and ready to link to your sites!
