import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import axios from 'axios'; // Importar axios
import { PaginaLogin } from '../paginas/PaginaLogin';
import { PaginaDashboard } from '../paginas/PaginaDashboard';
import { Layout } from './componentes/Layout';
import { PaginaCadastro } from '../paginas/PaginaCadastro'; 
import { PaginaDetalhes } from '../paginas/PaginaDetalhes';
import { PaginaAlertas } from '../paginas/PaginaAlertas';
import { PaginaAjuda } from '../paginas/PaginaAjuda';
import { PaginaPerfil } from '../paginas/PaginaPerfil';

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
  if (!estaLogado) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
};

// --- ROTAS ---
const router = createBrowserRouter([
  {
    path: '/login',
    element: <PaginaLogin />,
  },
  {
    path: '/',
    element: <RotaProtegida />,
    children: [
      { index: true, element: <PaginaDashboard /> },
      { path: 'cadastro', element: <PaginaCadastro /> },
      { path: 'preso/:presoId', element: <PaginaDetalhes /> },
      { path: 'alertas', element: <PaginaAlertas /> },
      { path: 'ajuda', element: <PaginaAjuda /> },
      { path: 'perfil', element: <PaginaPerfil /> }
    ]
  },
]);

function App() {
  return (
    <RouterProvider router={router} />
  );
}

export default App;