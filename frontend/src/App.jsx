import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';

import { PaginaLogin } from '../paginas/PaginaLogin';
import { PaginaDashboard } from '../paginas/PaginaDashboard';
import { Layout } from './componentes/Layout';
import { PaginaCadastro } from '../paginas/PaginaCadastro'; 
import { PaginaDetalhes } from '../paginas/PaginaDetalhes';
import { PaginaAlertas } from '../paginas/PaginaAlertas';
import { PaginaAjuda } from '../paginas/PaginaAjuda';
import { PaginaPerfil } from '../paginas/PaginaPerfil';
import { PaginaAdminUsuarios } from '../paginas/PaginaAdminUsuarios';


// --- LÓGICA DE AUTENTICAÇÃO ---

// Pega o token salvo no navegador
const token = localStorage.getItem('authToken');
let estaLogado = false;

if (token) {
  // Se temos um token, dizemos ao Axios para usá-lo em todas as requisições
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  estaLogado = true;
}

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
    <RouterProvider router={router} />
  );
}

// (Lembre-se de importar Box e CircularProgress do MUI se App.jsx não os tiver)
export default App;