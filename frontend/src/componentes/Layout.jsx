import React, { useState, useEffect } from 'react';
import { useTema } from '../TemaContext';
import { Switch } from '@mui/material';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { formatarData } from '../util/formatarData';
import {
  AppBar, Toolbar, Typography, Box, IconButton, Avatar,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  CssBaseline, Divider, Typography as MuiTypography, Menu, MenuItem,
  Tooltip, Badge
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';

// Ícones do Menu
import GavelIcon from '@mui/icons-material/Gavel';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu'; // Ícone Hamburguer


const drawerWidth = 240; // Largura do nosso menu lateral

const tiposDeEvento = {
  audiencia: "Audiência",
  reavaliacao_preventiva: "Reavaliação de Prisão",
  prazo_recurso: "Prazo de Recurso",
  outro: "Outro"
};

export function Layout() {
  const { modo, toggleTema } = useTema();
  const [mobileOpen, setMobileOpen] = useState(false); // Estado para menu mobile

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

// --- ESTADO PARA OS MENUS ---
  // Precisamos de um "anchor" (âncora) para cada menu, 
  // para o MUI saber onde o menu deve abrir.
  const [anchorElNotificacoes, setAnchorElNotificacoes] = useState(null);
  const [anchorElConfig, setAnchorElConfig] = useState(null);
  const [anchorElUsuario, setAnchorElUsuario] = useState(null);
  const [contagemAlertas, setContagemAlertas] = useState(0);
  const [alertasMenu, setAlertasMenu] = useState([]); // Lista para o dropdown
  const [isLoadingAlertas, setIsLoadingAlertas] = useState(false);
  

  // --- BUSCA A CONTAGEM TOTAL DE ALERTAS QUANDO O LAYOUT CARREGA ---
  useEffect(() => {
    const fetchContagemAlertas = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/alertas/ativos`);
        setContagemAlertas(response.data.length);
      } catch (error) {
        console.error("Erro ao buscar contagem de alertas:", error);
      }
    };
    fetchContagemAlertas();
  }, []); // O array vazio [] significa "rodar apenas uma vez"

  // --- Handlers para ABRIR os menus ---
 const handleAbrirMenuNotificacoes = async (event) => {
    setAnchorElNotificacoes(event.currentTarget);
    setIsLoadingAlertas(true);
    try {
      // Busca apenas os 5 mais urgentes
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/alertas/ativos?limit=5`);
      setAlertasMenu(response.data);
    } catch (error) {
      console.error("Erro ao buscar prévia de alertas:", error);
    } finally {
      setIsLoadingAlertas(false);
    }
  };
  const handleAbrirMenuConfig = (event) => {
    setAnchorElConfig(event.currentTarget);
  };
  const handleAbrirMenuUsuario = (event) => {
    setAnchorElUsuario(event.currentTarget);
  };

  // --- Handlers para FECHAR os menus ---
  const handleFecharMenuNotificacoes = () => {
    setAnchorElNotificacoes(null);
  };
  const handleFecharMenuConfig = () => {
    setAnchorElConfig(null);
  };
  const handleFecharMenuUsuario = () => {
    setAnchorElUsuario(null);
  };

const fazerLogout = () => {
    console.log("Fazendo logout...");
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/login'; // Força o recarregamento
  };

  // Definição do conteúdo do menu
  const menuItens = (
    <div>
      <Toolbar /> {/* Espaçador para ficar abaixo do AppBar */}
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/">
            <ListItemIcon><DashboardIcon /></ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/cadastro">
            <ListItemIcon><PersonAddIcon /></ListItemIcon>
            <ListItemText primary="Novo Cadastro" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/alertas">
            <ListItemIcon>
              <NotificationsIcon />
            </ListItemIcon>
            <ListItemText primary="Alertas de Prazo" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f6f7f8' }}>
      <CssBaseline /> {/* Reseta o CSS padrão (bom para o MUI) */}
      
      {/* 1. O Cabeçalho (AppBar) */}
      <AppBar 
        position="fixed" 
        sx={{ 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: '#ffffff',
          color: '#333333',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }} 
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: '700', color: '#0A2463', display: { xs: 'none', sm: 'block' } }}>
            Controle de Presos
          </Typography>

          <Box sx={{ flexGrow: 1 }} />
          
          {/* --- ÍCONES DO CABEÇALHO ATUALIZADOS --- */}
          <Box>
            {/* Ícone de Sino (Notificações) */}
            <Tooltip title="Notificações">
            <IconButton color="inherit" onClick={handleAbrirMenuNotificacoes}>
              {/* Badge agora usa a contagem real */}
              <Badge badgeContent={contagemAlertas} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

            {/* Ícone de Engrenagem (Configurações) */}
            <Tooltip title="Configurações">
              <IconButton color="inherit" onClick={handleAbrirMenuConfig}>
                <SettingsOutlinedIcon />
              </IconButton>
            </Tooltip>
            
            {/* Avatar do Usuário */}
            <Tooltip title="Opções do Usuário">
              <IconButton onClick={handleAbrirMenuUsuario} sx={{ p: 0, ml: 2 }}>
                <Avatar sx={{ width: 32, height: 32 }} alt="Usuário" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* --- MENUS DROPDOWN --- */}

      {/* Menu de Notificações */}
      <Menu
        anchorEl={anchorElNotificacoes}
        open={Boolean(anchorElNotificacoes)}
        onClose={handleFecharMenuNotificacoes}
      >
        {isLoadingAlertas ? (
          <MenuItem disabled>Carregando alertas...</MenuItem>
        ) : alertasMenu.length === 0 ? (
          <MenuItem disabled>Nenhum alerta ativo.</MenuItem>
        ) : (
          // Mapeia os alertas reais
          alertasMenu.map(alerta => (
            <MenuItem 
              key={alerta.id} 
              component={RouterLink} 
              to={`/preso/${alerta.processo.preso.id}`}
              onClick={handleFecharMenuNotificacoes}
            >
              <Typography variant="body2" noWrap>
                <strong>{alerta.processo.preso.nome_completo.split(' ')[0]}</strong>: {tiposDeEvento[alerta.tipo_evento]} em {formatarData(alerta.data_evento)}
              </Typography>
            </MenuItem>
          ))
        )}
        <Divider />
        <MenuItem component={RouterLink} to="/alertas" onClick={handleFecharMenuNotificacoes}>
          Ver todos os alertas
        </MenuItem>
      </Menu>

      {/* Menu de Configurações */}
      <Menu
        anchorEl={anchorElConfig}
        open={Boolean(anchorElConfig)}
        onClose={handleFecharMenuConfig}
      >
        <MenuItem 
          onClick={(e) => {
            // Impede o menu de fechar, mas aciona o toggle se
            // o usuário não clicar *exatamente* no switch
            toggleTema();
          }}
        >
          <ListItemText primary="Modo Escuro" />
          <Switch
            edge="end"
            checked={modo === 'dark'}
            onChange={toggleTema}
            onClick={(e) => e.stopPropagation()} // Impede o clique duplo
          />
        </MenuItem>
        
        <MenuItem component={RouterLink} to="/ajuda" onClick={handleFecharMenuConfig}>
          Ajuda
        </MenuItem>
      </Menu>

      {/* Menu do Usuário (Avatar) */}
      <Menu
        anchorEl={anchorElUsuario}
        open={Boolean(anchorElUsuario)}
        onClose={handleFecharMenuUsuario}
      >
        <MenuItem component={RouterLink} to="/perfil" onClick={handleFecharMenuUsuario}>
          Meu Perfil
        </MenuItem>
        <Divider />
        <MenuItem onClick={fazerLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'error.main' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          Sair
        </MenuItem>
      </Menu>

      {/* 2. O Menu Lateral (Drawer) */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Menu Mobile (temporário) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {menuItens}
        </Drawer>
        {/* Menu Desktop (permanente) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {menuItens}
        </Drawer>
      </Box>

      {/* 3. O Conteúdo (Dashboard, etc.) e Rodapé */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh', // Garante que o rodapé fique no fim
        }}
      >
        <Toolbar /> {/* Espaçador para o conteúdo ficar abaixo do AppBar */}
        
        {/* O <Outlet> renderiza a página (Dashboard, etc) */}
        <Box sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
        
        {/* Rodapé */}
        <Box 
          component="footer" 
          sx={{ 
            py: 2, // padding vertical
            px: 2,
            mt: 'auto', // Joga o rodapé para o fim
            textAlign: 'center',
            color: '#6c757d',
            borderTop: '1px solid #e0e0e0',
            fontSize: '0.9rem'
          }}
        >
          <MuiTypography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Sistema de Controle de Presos. Todos os direitos reservados.
          </MuiTypography>
        </Box>
      </Box>
    </Box>
  );
}