import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Skeleton, Grid,
  Button,
  IconButton, // Botão de ícone
  Tooltip // "Dica" do mouse
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // Ícone de "Concluir"
import VisibilityIcon from '@mui/icons-material/Visibility'; // Ícone de "Ver"
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // Para os filtros

const API_URL = 'http://127.0.0.1:8000';

// Função para formatar datas (YYYY-MM-DDTHH:MM -> DD/MM/YYYY HH:MM)
const formatarData = (dataISO) => {
  if (!dataISO) return 'N/A';
  try {
    const data = new Date(dataISO);
    return data.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return dataISO; }
};

// Mapeamento dos tipos de evento (para tradução)
const tiposDeEvento = {
  audiencia: "Audiência",
  reavaliacao_preventiva: "Reavaliação de Prisão",
  prazo_recurso: "Prazo de Recurso",
  outro: "Outro"
};

export function PaginaAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, estaSemana: 0, vencidos: 0 });

  // --- Função de Busca de Dados ---
  // (Usando useCallback para podermos chamá-la de dentro de outros handlers)
  const fetchAlertas = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/alertas/ativos`);
      const dados = response.data;
      setAlertas(dados);

      // Calcular Estatísticas
      const agora = new Date();
      const proximaSemana = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const alertasEstaSemana = dados.filter(a => new Date(a.data_evento) <= proximaSemana).length;
      // (O backend já filtra vencidos, mas podemos adicionar a lógica aqui se mudar)
      
      setStats({
        total: dados.length,
        estaSemana: alertasEstaSemana,
        vencidos: 0 // O endpoint /ativos já remove vencidos
      });

    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []); // useCallback com array de dependência vazio

  // Roda o fetchAlertas na montagem do componente
  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]); // A dependência agora é a própria função

  // --- Handler para "concluir" um alerta ---
  const handleConcluirAlerta = async (eventoId) => {
    try {
      await axios.patch(`${API_URL}/api/eventos/${eventoId}/status`, {
        status: 'concluido' // Envia o novo status
      });
      
      // Sucesso! Recarrega a lista de alertas
      // A lista será menor, pois o item "concluido" não virá mais do /api/alertas/ativos
      fetchAlertas();

    } catch (error) {
      console.error("Erro ao concluir alerta:", error);
      // TODO: Adicionar um Snackbar de erro
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: '#333', mb: 3 }}>
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
                            color: '#0A2463', 
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
                            component={RouterLink} 
                            to={`/preso/${alerta.processo.preso.id}`}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Marcar Alerta como Concluído">
                          <IconButton
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
        {/* TODO: Adicionar Paginação se necessário */}
      </Paper>
    </Box>
  );
}