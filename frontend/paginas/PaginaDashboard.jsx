import React, { useState, useEffect, useCallback } from 'react'; // Importa useEffect e useCallback
import api from '../src/api';
import {
  Box, Typography, TextField, Button, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, InputAdornment, Skeleton, Grid, FormControl,
  InputLabel, Select, MenuItem
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom'; // Importa o Link do Roteador


const opcoesStatusProcessual = [
  'Aguardando Julgamento',
  'Cumprindo Pena',
  'Aguardando Transferência',
  'Inquérito',
  'Liberado',
  'Outro',
];

// Função de Cor do Status (para o "ponto" colorido)
const getStatusColor = (status) => {
  if (!status) return '#6c757d'; // Cinza (N/A)
  status = status.toLowerCase();
  if (status.includes('julgamento') || status.includes('transferência')) return '#ffc107'; // Laranja
  if (status.includes('cumprindo') || status.includes('liberado')) return '#28a745'; // Verde
  return '#6c757d'; // Padrão
};

export function PaginaDashboard() {
  const [presos, setPresos] = useState([]); // Onde os dados da API ficarão
  const [isLoading, setIsLoading] = useState(true); // Estado de carregamento
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [filtros, setFiltros] = useState({
    nome: '',
    status_processual: '',
    data_prisao: '',
  });
  // --- FUNÇÃO PARA BUSCAR DADOS ---
  const fetchPresos = useCallback(async () => {
    setIsLoading(true);
    try {
      // Constrói os parâmetros de consulta dinamicamente
      const params = new URLSearchParams();
      if (filtros.nome) {
        params.append('nome', filtros.nome);
      }
      if (filtros.status_processual) {
        params.append('status_processual', filtros.status_processual);
      }
      if (filtros.data_prisao) {
        params.append('data_prisao', filtros.data_prisao);
      }

      // Converte os parâmetros para uma string (ex: "?nome=Joao&status=Liberado")
      const queryString = params.toString();
      
      const response = await api.get(`/api/presos/search/?${queryString}`);
      setPresos(response.data);
      setPage(0); // Reseta a paginação
    } catch (error) {
      console.error("Erro ao buscar presos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filtros]); // Re-cria a função se os 'filtros' mudarem

  // --- useEffect ---
  // Roda a função fetchPresos() assim que o componente é montado
  useEffect(() => {
    fetchPresos(); // Busca inicial (todos os presos)
  }, []); // O array vazio [] significa "rodar apenas uma vez"

  // Handler para o botão "Buscar"
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPresos();
  };
  
  // Handler para atualizar os filtros
  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Funções de paginação (iguais)
  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* 1. Título da Página (igual) */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', color: 'text.primary' }}>
          Dashboard de Busca
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Busque por presos usando um ou mais filtros.
        </Typography>
      </Box>


      {/* 2. Barra de Ferramentas (Busca e Filtros ATUALIZADA) */}
      <Paper 
        component="form"
        onSubmit={handleSearchSubmit} 
        sx={{ p: 2, mb: 3 }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              variant="outlined" // <-- Este estava correto
              label="Nome do Preso"
              name="nome"
              value={filtros.nome}
              onChange={handleFiltroChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            {/* --- CORREÇÃO AQUI --- */}
            <FormControl sx={{ m: 1, minWidth: 200 }} variant="outlined"> {/* <-- Adicione variant="outlined" */}
              <InputLabel id="status-label">Status Processual</InputLabel>
              <Select
                labelId="status-label"
                label="Status Processual" // Esta label é necessária
                name="status_processual"
                value={filtros.status_processual}
                onChange={handleFiltroChange}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                {opcoesStatusProcessual.map((opcao) => (
                  <MenuItem key={opcao} value={opcao}>{opcao}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            {/* --- CORREÇÃO AQUI --- */}
            <TextField
              fullWidth
              variant="outlined" // <-- Adicione variant="outlined"
              label="Data da Prisão"
              name="data_prisao"
              type="date"
              value={filtros.data_prisao}
              onChange={handleFiltroChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button 
              type="submit" 
              variant="contained"
              size="large"
              fullWidth
              sx={{ height: '56px' }} // Altura padrão do TextField outlined
            >
              Buscar
            </Button>
          </Grid>
        </Grid>
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
                              color: 'primary.main', 
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