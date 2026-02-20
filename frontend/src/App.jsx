import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext';
import { Layout } from './componentes/Layout';

const PaginaLogin = React.lazy(() => import('../paginas/PaginaLogin').then(m => ({ default: m.PaginaLogin })));
const PaginaDashboard = React.lazy(() => import('../paginas/PaginaDashboard').then(m => ({ default: m.PaginaDashboard })));
const PaginaCadastro = React.lazy(() => import('../paginas/PaginaCadastro').then(m => ({ default: m.PaginaCadastro })));
const PaginaDetalhes = React.lazy(() => import('../paginas/PaginaDetalhes').then(m => ({ default: m.PaginaDetalhes })));
const PaginaAlertas = React.lazy(() => import('../paginas/PaginaAlertas').then(m => ({ default: m.PaginaAlertas })));
const PaginaAjuda = React.lazy(() => import('../paginas/PaginaAjuda').then(m => ({ default: m.PaginaAjuda })));
const PaginaPerfil = React.lazy(() => import('../paginas/PaginaPerfil').then(m => ({ default: m.PaginaPerfil })));
const PaginaAdminUsuarios = React.lazy(() => import('../paginas/PaginaAdminUsuarios').then(m => ({ default: m.PaginaAdminUsuarios })));

// --- LÓGICA DE AUTENTICAÇÃO ---

// Elemento de Rota Protegida (mesmo de antes)
const RotaProtegida = () => {
  const { token } = useAuth(); // Lê o token do Contexto
  return token ? <Layout /> : <Navigate to="/login" replace />;
};

const RotaAdmin = () => {
  const { usuario } = useAuth(); // Lê o usuário (com 'role') do Contexto

  if (!usuario) {
    // Se o usuário ainda não carregou, não renderiza nada (ou um loading)
    return null;
  }

  // Se é admin, permite. Se não, joga para o Dashboard.
  return usuario.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
};

// --- ROTAS ---
const router = createBrowserRouter([
  {
    path: '/login',
    element: <PaginaLogin />,
  },
  {
    path: '/',
    element: <RotaProtegida />, // Protege todas as rotas filhas
    children: [
      { index: true, element: <PaginaDashboard /> },
      { path: 'cadastro', element: <PaginaCadastro /> },
      { path: 'preso/:presoId', element: <PaginaDetalhes /> },
      { path: 'alertas', element: <PaginaAlertas /> },
      { path: 'ajuda', element: <PaginaAjuda /> },
      { path: 'perfil', element: <PaginaPerfil /> },

      // --- NOVA ROTA DE ADMIN (aninhada) ---
      {
        path: 'admin',
        element: <RotaAdmin />, // 5. Protege o grupo de rotas de admin
        children: [
          { path: 'usuarios', element: <PaginaAdminUsuarios /> }
        ]
      }
    ]
  },
]);

function App() {
  const { isLoading } = useAuth();

  // Não renderiza as rotas até o AuthContext terminar o loading inicial
  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

// (Lembre-se de importar Box e CircularProgress do MUI se App.jsx não os tiver)
export default App;