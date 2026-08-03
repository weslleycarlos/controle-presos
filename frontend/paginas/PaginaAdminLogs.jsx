import React, { useState, useEffect, useCallback } from 'react';
import api from '../src/api';
import { extractErrorMessage } from '../src/util/apiError';
import {
  Box, Typography, Paper, Grid, TextField, Button, Chip, Skeleton,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Alert, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';

const FILTROS_INICIAIS = {
  acao: '',
  usuario_cpf: '',
  sucesso: '',
  data_inicio: '',
  data_fim: '',
};

// Ações que merecem destaque visual por serem sensíveis ou destrutivas.
const ACOES_CRITICAS = new Set([
  'preso_excluido',
  'evento_excluido',
  'usuario_senha_resetada',
  'usuario_criado',
  'acesso_negado',
]);

function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

export function PaginaAdminLogs() {
  const [logs, setLogs] = useState([]);
  const [acoesDisponiveis, setAcoesDisponiveis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAIS);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'error' });

  const fecharSnack = () => setSnack((prev) => ({ ...prev, open: false }));

  // Carrega a lista de ações uma única vez, para montar o filtro.
  useEffect(() => {
    const buscarAcoes = async () => {
      try {
        const { data } = await api.get('/api/logs/acoes');
        setAcoesDisponiveis(data);
      } catch (error) {
        console.error('Erro ao buscar ações de auditoria:', error);
      }
    };
    buscarAcoes();
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('skip', String(page * rowsPerPage));
      params.append('limit', String(rowsPerPage));

      if (filtrosAplicados.acao) params.append('acao', filtrosAplicados.acao);
      if (filtrosAplicados.usuario_cpf) {
        params.append('usuario_cpf', filtrosAplicados.usuario_cpf.replace(/[^\d]+/g, ''));
      }
      if (filtrosAplicados.sucesso !== '') params.append('sucesso', filtrosAplicados.sucesso);
      // O input date entrega só a data; completamos a hora para pegar o dia inteiro.
      if (filtrosAplicados.data_inicio) {
        params.append('data_inicio', `${filtrosAplicados.data_inicio}T00:00:00`);
      }
      if (filtrosAplicados.data_fim) {
        params.append('data_fim', `${filtrosAplicados.data_fim}T23:59:59`);
      }

      const response = await api.get(`/api/logs?${params.toString()}`);
      setLogs(response.data);
      setTotal(Number(response.headers['x-total-count'] ?? response.data.length ?? 0));
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      setSnack({
        open: true,
        message: extractErrorMessage(error, 'Erro ao carregar os registros de auditoria.'),
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, rowsPerPage, filtrosAplicados]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setPage(0);
    setFiltrosAplicados(filtros);
  };

  const limparFiltros = () => {
    setFiltros(FILTROS_INICIAIS);
    setFiltrosAplicados(FILTROS_INICIAIS);
    setPage(0);
  };

  const rotuloDaAcao = (valor) =>
    acoesDisponiveis.find((a) => a.valor === valor)?.rotulo || valor;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800' }}>
          Registros de Auditoria
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Histórico de quem fez o quê no sistema, quando e a partir de qual endereço.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper component="form" onSubmit={aplicarFiltros} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="acao-label">Ação</InputLabel>
              <Select
                labelId="acao-label"
                label="Ação"
                name="acao"
                value={filtros.acao}
                onChange={handleFiltroChange}
              >
                <MenuItem value=""><em>Todas</em></MenuItem>
                {acoesDisponiveis.map((acao) => (
                  <MenuItem key={acao.valor} value={acao.valor}>{acao.rotulo}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="CPF do usuário"
              name="usuario_cpf"
              value={filtros.usuario_cpf}
              onChange={handleFiltroChange}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="sucesso-label">Resultado</InputLabel>
              <Select
                labelId="sucesso-label"
                label="Resultado"
                name="sucesso"
                value={filtros.sucesso}
                onChange={handleFiltroChange}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                <MenuItem value="true">Sucesso</MenuItem>
                <MenuItem value="false">Falha</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="De"
              name="data_inicio"
              type="date"
              value={filtros.data_inicio}
              onChange={handleFiltroChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Até"
              name="data_fim"
              type="date"
              value={filtros.data_fim}
              onChange={handleFiltroChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 1 }} sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" size="small" fullWidth>
              Filtrar
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLogs}
              disabled={isLoading}
            >
              Atualizar
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<ClearIcon />}
              onClick={limparFiltros}
              disabled={isLoading}
            >
              Limpar filtros
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabela */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Data/Hora</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Usuário</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Ação</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Detalhe</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Origem (IP)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}><Skeleton variant="rounded" height={120} /></TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    Nenhum registro encontrado para os filtros informados.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow hover key={log.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatarDataHora(log.data_hora)}
                    </TableCell>
                    <TableCell>
                      {log.usuario_nome || <em>não identificado</em>}
                      {log.usuario_cpf && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {log.usuario_cpf}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={rotuloDaAcao(log.acao)}
                        color={
                          !log.sucesso ? 'error'
                            : ACOES_CRITICAS.has(log.acao) ? 'warning'
                              : 'default'
                        }
                        variant={log.sucesso ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Tooltip title={log.detalhe || ''} placement="top">
                        <Typography variant="body2" noWrap>
                          {log.detalhe || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.ip || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, novaPagina) => setPage(novaPagina)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Linhas por página:"
        />
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={fecharSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={fecharSnack} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
