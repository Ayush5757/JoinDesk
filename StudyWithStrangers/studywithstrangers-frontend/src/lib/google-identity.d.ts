export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            // called when the Google window is closed or can't be opened
            error_callback?: (error: { type?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}
