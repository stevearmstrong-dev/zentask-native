/**
 * ZenTask Design System
 * Centralized theme tokens for consistent styling across the app
 */

// ============================================================================
// COLORS
// ============================================================================

export const Colors = {
  // Background
  background: {
    primary: '#1C1C1E',      // Main screen background
    secondary: '#0A0A0F',    // Modal/focus mode background
    elevated: '#2C2C2E',     // Raised surfaces
    overlay: 'rgba(0,0,0,0.5)',
  },

  // Surface (cards, containers)
  surface: {
    base: 'rgba(255,255,255,0.06)',
    elevated: 'rgba(255,255,255,0.08)',
    input: 'rgba(255,255,255,0.06)',
    hover: 'rgba(255,255,255,0.12)',
  },

  // Borders
  border: {
    subtle: 'rgba(255,255,255,0.08)',
    default: 'rgba(255,255,255,0.1)',
    strong: 'rgba(255,255,255,0.15)',
    focus: 'rgba(24,119,242,0.4)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#EBEBF5',
    tertiary: '#636366',
    disabled: '#48484A',
    inverse: '#000000',
  },

  // Priority colors
  priority: {
    high: '#FF453A',
    medium: '#FF9F0A',
    low: '#30D158',
  },

  // Semantic colors
  semantic: {
    success: '#30D158',
    error: '#FF453A',
    warning: '#FF9F0A',
    info: '#1877F2',
  },

  // Interactive
  interactive: {
    primary: '#1877F2',      // Main action buttons
    primaryHover: '#0D65D9',
    secondary: '#007AFF',    // iOS blue
    secondaryHover: '#0051D5',
    destructive: '#FF453A',
    destructiveHover: '#FF2D20',
  },

  // Status
  status: {
    online: '#30D158',
    offline: '#636366',
    away: '#FF9F0A',
  },

  // Overlays for priority badges
  priorityOverlay: {
    high: 'rgba(255,69,58,0.2)',
    medium: 'rgba(255,159,10,0.2)',
    low: 'rgba(48,209,88,0.2)',
  },

  // Category badge
  category: {
    background: 'rgba(24,119,242,0.2)',
    text: '#1877F2',
  },
};

// ============================================================================
// SPACING
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const Typography = {
  // Font sizes
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 17,
    xxl: 18,
    xxxl: 22,
    huge: 26,
    display: 72,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 2,
  },
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 18,
  full: 9999,
};

// ============================================================================
// SHADOWS (iOS-style)
// ============================================================================

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 8,
  },
};

// ============================================================================
// ANIMATION TIMING
// ============================================================================

export const Timing = {
  instant: 0,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 400,
};

// ============================================================================
// TOUCH TARGETS
// ============================================================================

export const TouchTarget = {
  min: 44,  // iOS minimum recommended
  comfortable: 48,
  large: 56,
};

// ============================================================================
// ICON SIZES
// ============================================================================

export const IconSize = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
};

// ============================================================================
// OPACITY LEVELS
// ============================================================================

export const Opacity = {
  disabled: 0.5,
  hover: 0.8,
  pressed: 0.6,
  overlay: 0.4,
};

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const ComponentTokens = {
  // Task Item
  taskItem: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    checkboxSize: 24,
    checkboxRadius: 12,
  },

  // Buttons
  button: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: TouchTarget.min,
  },

  // Inputs
  input: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 60,
  },

  // Chips/Tags
  chip: {
    borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },

  // Badges
  badge: {
    borderRadius: BorderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },

  // Modal
  modal: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color with opacity
 * @param color - Hex color code
 * @param opacity - Opacity value (0-1)
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Convert opacity to hex (0-1 to 00-FF)
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${color}${alpha}`;
};

/**
 * Get priority color
 */
export const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
  return Colors.priority[priority] || Colors.priority.medium;
};

/**
 * Get priority overlay color
 */
export const getPriorityOverlay = (priority: 'high' | 'medium' | 'low'): string => {
  return Colors.priorityOverlay[priority] || Colors.priorityOverlay.medium;
};
