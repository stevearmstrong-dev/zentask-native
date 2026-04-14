import { gapi } from 'gapi-script';

const CLIENT_ID = '492782135611-op2m9qspo0lusmjh3oud9kdsijrc9hrv.apps.googleusercontent.com';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

class GoogleCalendarService {
  constructor() {
    this.isInitialized = false;
    this.isSignedIn = false;
  }

  // Initialize the Google API client
  init() {
    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', () => {
        gapi.client
          .init({
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES,
          })
          .then(() => {
            this.isInitialized = true;

            // Listen for sign-in state changes
            gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
              this.isSignedIn = isSignedIn;
            });

            // Handle initial sign-in state
            this.isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();

            resolve(this.isSignedIn);
          })
          .catch((error) => {
            console.error('Error initializing Google API:', error);
            reject(error);
          });
      });
    });
  }

  // Sign in to Google
  signIn() {
    return gapi.auth2.getAuthInstance().signIn();
  }

  // Sign out from Google
  signOut() {
    return gapi.auth2.getAuthInstance().signOut();
  }

  // Check if user is signed in
  getIsSignedIn() {
    if (!this.isInitialized) return false;
    return gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  // Get user profile
  getUserProfile() {
    if (!this.getIsSignedIn()) return null;
    const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    return {
      name: profile.getName(),
      email: profile.getEmail(),
      imageUrl: profile.getImageUrl(),
    };
  }

  // Create a calendar event from a task
  async createEvent(task) {
    if (!this.getIsSignedIn()) {
      throw new Error('User not signed in');
    }

    if (!task.dueDate) {
      throw new Error('Task must have a due date');
    }

    try {
      // Parse the due date in local timezone to avoid UTC conversion issues
      const [year, month, day] = task.dueDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, day);

      if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(':');
        startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        startDate.setHours(9, 0, 0, 0); // Default to 9 AM if no time specified
      }

      // End time is 1 hour after start
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      const event = {
        summary: task.text,
        description: `Priority: ${task.priority || 'medium'}${task.category ? `\nCategory: ${task.category}` : ''}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        reminders: {
          useDefault: false,
          overrides: task.reminderMinutes
            ? [{ method: 'popup', minutes: task.reminderMinutes }]
            : [{ method: 'popup', minutes: 15 }],
        },
      };

      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  // Update a calendar event
  async updateEvent(eventId, task) {
    if (!this.getIsSignedIn()) {
      throw new Error('User not signed in');
    }

    if (!task.dueDate) {
      throw new Error('Task must have a due date');
    }

    try {
      // Parse the due date in local timezone to avoid UTC conversion issues
      const [year, month, day] = task.dueDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, day);

      if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(':');
        startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        startDate.setHours(9, 0, 0, 0);
      }

      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      const event = {
        summary: task.text,
        description: `Priority: ${task.priority || 'medium'}${task.category ? `\nCategory: ${task.category}` : ''}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        reminders: {
          useDefault: false,
          overrides: task.reminderMinutes
            ? [{ method: 'popup', minutes: task.reminderMinutes }]
            : [{ method: 'popup', minutes: 15 }],
        },
      };

      const response = await gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  // Delete a calendar event
  async deleteEvent(eventId) {
    if (!this.getIsSignedIn()) {
      throw new Error('User not signed in');
    }

    try {
      await gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
