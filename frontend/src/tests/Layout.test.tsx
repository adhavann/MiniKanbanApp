import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Layout from '../components/Layout';
import { AuthProvider } from '../hooks/useAuth';

const theme = createTheme();

const MockLayout = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <BrowserRouter>
      <AuthProvider>
        <Layout>{children}</Layout>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);

describe('Layout', () => {
  it('renders app title', () => {
    render(
      <MockLayout>
        <div>Test Content</div>
      </MockLayout>
    );
    
    expect(screen.getByText('Mini Kanban App')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <MockLayout>
        <div>Test Content</div>
      </MockLayout>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
