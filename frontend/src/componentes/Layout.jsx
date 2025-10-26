import React, { useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
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

export function Layout() {
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

  // --- Handlers para ABRIR os menus ---
  const handleAbrirMenuNotificacoes = (event) => {
    setAnchorElNotificacoes(event.currentTarget);
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
                <Badge badgeContent={4} color="error"> {/* Badge estático por enquanto */}
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
        <MenuItem onClick={handleFecharMenuNotificacoes}>Alerta: Audiência João da Silva</MenuItem>
        <MenuItem onClick={handleFecharMenuNotificacoes}>Alerta: Prazo Maria Oliveira</MenuItem>
        <MenuItem onClick={handleFecharMenuNotificacoes}>* Ver todos os alertas *</MenuItem>
      </Menu>

      {/* Menu de Configurações */}
      <Menu
        anchorEl={anchorElConfig}
        open={Boolean(anchorElConfig)}
        onClose={handleFecharMenuConfig}
      >
        <MenuItem onClick={handleFecharMenuConfig}>Preferências</MenuItem>
        <MenuItem onClick={handleFecharMenuConfig}>Ajuda</MenuItem>
      </Menu>

      {/* Menu do Usuário (Avatar) */}
      <Menu
        anchorEl={anchorElUsuario}
        open={Boolean(anchorElUsuario)}
        onClose={handleFecharMenuUsuario}
      >
        <MenuItem onClick={handleFecharMenuUsuario}>Meu Perfil</MenuItem>
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