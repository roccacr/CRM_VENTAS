import { ThemeProvider } from '@mui/material/styles';
import { oneDriveTheme } from './theme/oneDriveTheme';
import { AppRouter } from "./routers/AppRouter"


export const App = () => {
  return (
    <ThemeProvider theme={oneDriveTheme}>
      <AppRouter/>
    </ThemeProvider>
  )
}
