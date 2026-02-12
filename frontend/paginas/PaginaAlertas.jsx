import React, { useState, useEffect, useCallback } from 'react';
import api from '../src/api';
import { formatarData } from '../src/util/formatarData';
import { tiposDeEvento } from '../src/util/tiposEvento';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Skeleton, Grid,
  Button,
  IconButton, // Botão de ícone
  Tooltip, // "Dica" do mouse
  Snackbar,
  Alert,
  TablePagination
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // Ícone de "Concluir"
import VisibilityIcon from '@mui/icons-material/Visibility'; // Ícone de "Ver"
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // Para os filtros

export function PaginaAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [stats, setStats] = useState({ total: 0, estaSemana: 0, vencidos: 0 });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // --- Função de Busca de Dados ---
  // (Usando useCallback para podermos chamá-la de dentro de outros handlers)
  const fetchAlertas = useCallback(async () => {
    setIsLoading(true);
    try {
      const skip = page * rowsPerPage;
      const response = await api.get(`/api/alertas/ativos?skip=${skip}&limit=${rowsPerPage}`);
      const dados = response.data;
      setAlertas(dados);

      const total = Number(response.headers['x-total-count'] || dados.length || 0);
      const estaSemana = Number(response.headers['x-week-count'] || 0);
      setTotalAlertas(total);
      
      setStats({
        total,
        estaSemana,
        vencidos: 0 // O endpoint /ativos já remove vencidos
      });

    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
      setSnack({ open: true, message: 'Erro ao carregar alertas.', severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [page, rowsPerPage]);

  // Roda o fetchAlertas na montagem do componente
  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]); // A dependência agora é a própria função

  // --- Handler para "concluir" um alerta ---
  const handleConcluirAlerta = async (eventoId) => {
    try {
      await api.patch(`/api/eventos/${eventoId}/status`, {
        status: 'concluido' // Envia o novo status
      });
      
      // Sucesso! Recarrega a lista de alertas
      // A lista será menor, pois o item "concluido" não virá mais do /api/alertas/ativos
      fetchAlertas();

    } catch (error) {
      console.error("Erro ao concluir alerta:", error);
      setSnack({ open: true, message: 'Erro ao concluir alerta.', severity: 'error' });
    }
  };

  const handleCloseSnack = () => setSnack(prev => ({ ...prev, open: false }));
  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: 'text.primary', mb: 3 }}>
        Gestão de Alertas
      </Typography>

      {/* 1. Cards de Estatísticas (do protótipo) */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">Total de Alertas Ativos</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{isLoading ? '...' : stats.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#fff8e1' }}>
            <Typography variant="h6" color="#f57f17">Vencendo Esta Semana</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#f57f17' }}>{isLoading ? '...' : stats.estaSemana}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#ffebee' }}>
            <Typography variant="h6" color="#c62828">Alertas Vencidos</Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#c62828' }}>{isLoading ? '...' : stats.vencidos}</Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* 2. Filtros (do protótipo - TODO: Implementar lógica) */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ p: 1, fontWeight: 'bold' }}>Filtros:</Typography>
        <Button variant="outlined" endIcon={<ExpandMoreIcon />}>Status: Pendente</Button>
        <Button variant="outlined" endIcon={<ExpandMoreIcon />}>Tipo: Todos</Button>
      </Paper>

      {/* 3. Tabela de Alertas */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="tabela de alertas">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Urgência</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Data do Prazo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nome do Preso</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo do Alerta</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nº Processo (PJe)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0 }}>
                    <Box sx={{ p: 2, m: 2 }}><Skeleton variant="rounded" width="100%" height={60} /></Box>
                  </TableCell>
                </TableRow>
              ) : (
                alertas.map((alerta) => {
                  const dataEvento = new Date(alerta.data_evento);
                  const hoje = new Date();
                  const diffDias = (dataEvento.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
                  const eUrgente = diffDias <= 7;

                  return (
                    <TableRow hover key={alerta.id}>
                      <TableCell>
                        {eUrgente ? (
                          <Chip icon={<WarningAmberIcon />} label="Urgente" color="warning" size="small" />
                        ) : (
                          <Chip label="Normal" size="small" />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {formatarData(alerta.data_evento)}
                      </TableCell>
                      <TableCell>
                        <Typography 
                          component={RouterLink}
                          to={`/preso/${alerta.processo.preso.id}`} // Link para detalhes
                          variant="body2" 
                          sx={{ 
                            fontWeight: '500', 
                              color: 'primary.main', 
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' } 
                          }}
                        >
                          {alerta.processo.preso.nome_completo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {tiposDeEvento[alerta.tipo_evento] || alerta.tipo_evento}
                      </TableCell>
                      <TableCell>
                        {alerta.processo.numero_processo}
                      </TableCell>
                      
                      {/* --- CÉLULA DE AÇÕES ATUALIZADA --- */}
                      <TableCell sx={{ textAlign: 'center', p: 0 }}>
                        <Tooltip title="Ver Detalhes do Preso">
                          <IconButton 
                            aria-label="Ver detalhes do preso"
                            component={RouterLink} 
                            to={`/preso/${alerta.processo.preso.id}`}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Marcar Alerta como Concluído">
                          <IconButton
                            aria-label="Concluir alerta"
                            color="success"
                            onClick={() => handleConcluirAlerta(alerta.id)}
                          >
                            <CheckCircleOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!isLoading && alertas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', p: 4 }}>
                    <Typography color="text.secondary">Nenhum alerta ativo no momento.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalAlertas}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Linhas por página:"
        />
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnack} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}