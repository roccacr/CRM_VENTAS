import { createTheme } from '@mui/material/styles';

export const oneDriveTheme = createTheme({
  palette: {
    primary: {
      main: '#0078D4',
      light: '#106EBE',
      dark: '#005A9E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#666666',
      light: '#91A3B0',
      dark: '#333333',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F8F9FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h6: {
      fontSize: '18px',
      fontWeight: 500,
    },
    subtitle1: {
      fontSize: '16px',
      fontWeight: 500,
    },
    body1: {
      fontSize: '14px',
    },
    body2: {
      fontSize: '14px',
      color: '#666666',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '2px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '2px',
          boxShadow: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E5E5E5',
          padding: '8px 16px',
        },
        head: {
          fontWeight: 500,
          color: '#666666',
        },
      },
    },
  },
}); 