import React, { useState, useEffect } from 'react'; // Importa useEffect
import axios from 'axios'; // Importa axios
import {
  Box, Typography, TextField, Button, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, InputAdornment, Skeleton // Skeleton para o "loading"
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom'; // Importa o Link do Roteador

const API_URL = 'http://127.0.0.1:8000';

// Função de Cor do Status (para o "ponto" colorido)
const getStatusColor = (status) => {
  if (!status) return '#6c757d'; // Cinza (N/A)
  status = status.toLowerCase();
  if (status.includes('julgamento') || status.includes('transferência')) return '#ffc107'; // Laranja
  if (status.includes('cumprindo') || status.includes('liberado')) return '#28a745'; // Verde
  return '#6c757d'; // Padrão
};

export function PaginaDashboard() {
  const [termoBusca, setTermoBusca] = useState('');
  const [presos, setPresos] = useState([]); // Onde os dados da API ficarão
  const [isLoading, setIsLoading] = useState(true); // Estado de carregamento
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // --- FUNÇÃO PARA BUSCAR DADOS ---
  const fetchPresos = async (busca = '') => {
    setIsLoading(true);
    try {
      // O token já está no Axios (configurado no App.jsx)
      const response = await axios.get(`${API_URL}/api/presos/search/?nome=${busca}`);
      setPresos(response.data);
      setPage(0); // Reseta a paginação a cada nova busca
    } catch (error) {
      console.error("Erro ao buscar presos:", error);
      // TODO: Adicionar um Snackbar de erro aqui também
    } finally {
      setIsLoading(false);
    }
  };

  // --- useEffect ---
  // Roda a função fetchPresos() assim que o componente é montado
  useEffect(() => {
    fetchPresos(); // Busca inicial (todos os presos)
  }, []); // O array vazio [] significa "rodar apenas uma vez"

  const handleSearchSubmit = (e) => {
    e.preventDefault(); // Impede o recarregamento da página (se estivesse em um <form>)
    fetchPresos(termoBusca);
  };
  
  // Funções de paginação (iguais)
  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* 1. Título da Página */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', color: '#333' }}>
          Dashboard de Busca
        </Typography>
        <Typography variant="body1" sx={{ color: '#6c757d' }}>
          Busque por presos pelo nome e veja dados essenciais.
        </Typography>
      </Box>


      {/* 2. Barra de Ferramentas (Busca e Filtros) */}
      <Paper 
        component="form" // Torna a Paper um formulário
        onSubmit={handleSearchSubmit} // Chama a busca ao pressionar Enter
        sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Digite o nome completo do preso..."
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          sx={{ flexGrow: 1, minWidth: '300px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        {/* Este botão agora funciona */}
        <Button 
          type="submit" 
          variant="contained"
          size="large"
          startIcon={<SearchIcon />}
          sx={{ height: '56px' }} // Alinha altura com o TextField
        >
          Buscar
        </Button>
      </Paper>

      {/* 3. Tabela de Resultados */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="tabela de presos">
            <TableHead>
              {/* (Cabeçalho da Tabela igual) */}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nome</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status do Processo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo da Prisão</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Data da Prisão</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Local</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                // --- Tela de Loading (Esqueleto) ---
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0 }}>
                    <Box sx={{ p: 2, m: 2 }}><Skeleton variant="rounded" width="100%" height={60} /></Box>
                    <Box sx={{ p: 2, m: 2 }}><Skeleton variant="rounded" width="100%" height={60} /></Box>
                  </TableCell>
                </TableRow>
              ) : (
                // --- Dados Reais ---
                presos
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((preso) => {
                    // Pega o *primeiro* processo da lista (ou um objeto vazio)
                    const processo = preso.processos?.[0] || {};
                    
                    return (
                      <TableRow hover key={preso.id}>
                        <TableCell>
                          <Typography 
                            component={RouterLink} // Usa o Link do Roteador
                            to={`/preso/${preso.id}`} // Link para a página de detalhes
                            variant="body2" 
                            sx={{ 
                              fontWeight: '500', 
                              color: '#0A2463', 
                              textDecoration: 'none',
                              '&:hover': { textDecoration: 'underline' } 
                            }}
                          >
                            {preso.nome_completo}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ 
                              width: 10, height: 10, borderRadius: '50%', 
                              backgroundColor: getStatusColor(processo.status_processual) 
                            }} />
                            {processo.status_processual || 'N/A'}
                          </Box>
                        </TableCell>
                        <TableCell>{processo.tipo_prisao || 'N/A'}</TableCell>
                        <TableCell>{processo.data_prisao || 'N/A'}</TableCell>
                        <TableCell>{processo.local_segregacao || 'N/A'}</TableCell>
                        <TableCell>
                          <Button 
                            component={RouterLink} // Usa o Link do Roteador
                            to={`/preso/${preso.id}`} // Link para a página de detalhes
                            size="small"
                          >
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>


       {/* 4. Paginação */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={presos.length} // Total de itens
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Linhas por página:"
        />
      </Paper>
    </Box>
  );
}