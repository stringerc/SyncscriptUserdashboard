# Adding Sign Up & Login Buttons to SyncScript Dashboard

## Quick Guide: Where to Add These Buttons

Since your dashboard is for logged-in users, you might want Sign Up/Login buttons in:
1. The header (top right, replacing or next to the avatar)
2. A dedicated auth page/modal
3. The sidebar (at the bottom)

---

## Option 1: Add to Header (Recommended for Guest Users)

Edit `/components/DashboardHeader.tsx`:

### Replace the user avatar section with conditional rendering:

```typescript
{/* Right Side Icons */}
<div className="flex items-center gap-4">
  {/* ... existing notification, AI toggle, energy mode ... */}
  
  {/* For logged-out users - show Sign Up & Login */}
  {!isUserLoggedIn && (
    <>
      <button
        onClick={() => navigateToExternal(navigationLinks.external.login)}
        data-nav="login-button"
        className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
      >
        Login
      </button>
      <button
        onClick={() => navigateToExternal(navigationLinks.external.signup)}
        data-nav="signup-button"
        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all hover:scale-105 active:scale-95"
      >
        Start Free Trial
      </button>
    </>
  )}
  
  {/* For logged-in users - show avatar */}
  {isUserLoggedIn && (
    <div 
      onClick={() => navigate(navigationLinks.header.profile)}
      data-nav="user-profile"
    >
      <AnimatedAvatar
        src="https://images.unsplash.com/photo-1758639842445-b58f639119d2?w=100&h=100&fit=crop"
        fallback="U"
        progress={85}
        animationType="glow"
        className="w-9 h-9 cursor-pointer hover:scale-110 transition-transform"
        size={36}
      />
    </div>
  )}
</div>
```

---

## Option 2: Add to Sidebar Bottom (Alternative)

Edit `/components/Sidebar.tsx`:

### Add buttons above Settings:

```typescript
export function Sidebar() {
  // ... existing code ...
  
  return (
    <div className="w-[140px] bg-[#1e2128] border-r border-gray-800 flex flex-col items-center py-6 space-y-8 backdrop-blur-sm">
      {/* ... logo and navigation items ... */}
      
      {/* Auth Buttons (for logged-out users) */}
      <div className="flex flex-col items-center gap-3 w-full px-4">
        <button
          onClick={() => navigateToExternal(navigationLinks.external.signup)}
          data-nav="signup-sidebar"
          className="w-full bg-teal-600 hover:bg-teal-500 text-white py-2 rounded-lg transition-all hover:scale-105 active:scale-95 text-xs"
        >
          Start Free
        </button>
        <button
          onClick={() => navigateToExternal(navigationLinks.external.login)}
          data-nav="login-sidebar"
          className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-all hover:scale-105 active:scale-95 text-xs"
        >
          Login
        </button>
      </div>
      
      {/* Settings at bottom */}
      <div /* ... existing settings code ... */ />
    </div>
  );
}
```

---

## Option 3: Create a Dedicated Auth Modal/Dialog

### 1. Create `/components/AuthModal.tsx`:

```typescript
import { X } from 'lucide-react';
import { navigationLinks, navigateToExternal } from '../utils/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1e2128] border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header */}
        <h2 className="text-white text-2xl mb-2">Welcome to SyncScript</h2>
        <p className="text-gray-400 mb-8">
          Sign up to start optimizing your productivity with AI-powered insights.
        </p>
        
        {/* Sign Up Button */}
        <button
          onClick={() => {
            navigateToExternal(navigationLinks.external.signup);
            onClose();
          }}
          data-nav="signup-modal"
          className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white py-3 rounded-lg transition-all hover:scale-105 active:scale-95 mb-4"
        >
          Start Free Trial
        </button>
        
        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>
        
        {/* Login Button */}
        <button
          onClick={() => {
            navigateToExternal(navigationLinks.external.login);
            onClose();
          }}
          data-nav="login-modal"
          className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
        >
          Login to Existing Account
        </button>
        
        {/* Footer */}
        <p className="text-gray-500 text-center mt-6">
          By signing up, you agree to our{' '}
          <a href="https://syncscript.com/terms" className="text-teal-500 hover:text-teal-400">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 2. Use the modal in your app:

```typescript
// In App.tsx or any component
import { useState } from 'react';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  return (
    <>
      {/* Your dashboard */}
      <div className="...">
        {/* Add a trigger button anywhere */}
        <button onClick={() => setIsAuthModalOpen(true)}>
          Sign Up
        </button>
      </div>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
}
```

---

## Option 4: Add Floating CTA Button (Non-intrusive)

### Create a floating button that appears in the bottom right:

```typescript
// In any component or create /components/FloatingCTA.tsx

export function FloatingCTA() {
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button
        onClick={() => navigateToExternal(navigationLinks.external.signup)}
        data-nav="floating-signup"
        className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white px-6 py-3 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center gap-2 group"
      >
        <span>Start Free Trial</span>
        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
```

---

## Styling Options for Buttons

### Gradient Button (Premium Look):
```typescript
className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
```

### Solid Teal Button:
```typescript
className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
```

### Outline Button:
```typescript
className="border-2 border-teal-600 hover:border-teal-500 text-teal-600 hover:text-teal-500 px-6 py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
```

### Ghost Button:
```typescript
className="text-gray-300 hover:text-white hover:bg-gray-700 px-6 py-3 rounded-lg transition-all"
```

---

## Complete Example: Adding to Header

Here's the exact code to add to your `DashboardHeader.tsx`:

```typescript
// At the top, add this import
import { navigateToExternal } from '../utils/navigation';

// Replace the user avatar section (around line 85) with:
<div className="flex items-center gap-3">
  <button
    onClick={() => navigateToExternal(navigationLinks.external.login)}
    data-nav="header-login"
    className="text-gray-300 hover:text-white px-4 py-2 transition-colors"
  >
    Login
  </button>
  <button
    onClick={() => navigateToExternal(navigationLinks.external.signup)}
    data-nav="header-signup"
    className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white px-6 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg"
  >
    Start Free Trial
  </button>
</div>
```

---

## Configuring the URLs

Don't forget to update `/utils/navigation.ts`:

```typescript
external: {
  signup: 'https://yoursite.com/signup',  // ← Your signup page
  login: 'https://yoursite.com/login',    // ← Your login page
  
  // Or if using the same site:
  signup: '/signup',
  login: '/login',
},
```

---

## Testing

After adding buttons, test them:

```javascript
// In browser console
document.querySelector('[data-nav="signup-button"]').click();
document.querySelector('[data-nav="login-button"]').click();
```

---

## Summary

Choose the option that fits your needs:
- **Option 1**: Header buttons (best for marketing/landing pages)
- **Option 2**: Sidebar buttons (always visible)
- **Option 3**: Modal dialog (better UX, doesn't leave page)
- **Option 4**: Floating CTA (non-intrusive, always visible)

All options use the same navigation system and are fully integrated with your data attributes system.
