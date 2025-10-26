import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Typography, Paper, Grid, CircularProgress, Alert,
  Breadcrumbs, Link, Button, Divider, Avatar, Chip,
  Accordion, AccordionSummary, AccordionDetails,
  Modal, Fade, Backdrop, TextField, FormControl,
  InputLabel, Select, MenuItem, Snackbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { IMaskInput } from 'react-imask'; // Importa a máscara

// Ícones
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PersonIcon from '@mui/icons-material/Person';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GavelIcon from '@mui/icons-material/Gavel';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// --- CONSTANTES E HELPERS ---

const API_URL = 'http://127.0.0.1:8000';

// Estilo do Modal (para centralizá-lo)
const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 500 }, // Responsivo
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

// Função para formatar datas (YYYY-MM-DD -> DD/MM/YYYY)
const formatarData = (dataISO, incluirHoras = false) => {
  if (!dataISO) return 'N/A';
  try {
    const data = new Date(dataISO);
    const opcoesData = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };
    const opcoesHora = {
      hour: '2-digit',
      minute: '2-digit',
    };
    
    const opcoes = incluirHoras 
      ? { ...opcoesData, ...opcoesHora } 
      : opcoesData;
      
    return data.toLocaleString('pt-BR', opcoes);
  } catch (e) {
    // Tenta formatar apenas a data se falhar (ex: '2023-10-25')
    try {
      const [ano, mes, dia] = dataISO.split('T')[0].split('-');
      return `${dia}/${mes}/${ano}`;
    } catch (e2) {
      return dataISO; // Retorna o original se tudo falhar
    }
  }
};

// Mapeamento dos tipos de evento (do nosso backend/models.py)
const tiposDeEvento = {
  audiencia: "Audiência",
  reavaliacao_preventiva: "Reavaliação de Prisão",
  prazo_recurso: "Prazo de Recurso",
  outro: "Outro"
};

// Opções para os campos Select (da PaginaCadastro)
const opcoesTipoPrisao = [
  'Preventiva',
  'Flagrante',
  'Temporária',
  'Sentença Condenatória',
  'Outra',
];

const opcoesStatusProcessual = [
  'Aguardando Julgamento',
  'Cumprindo Pena',
  'Aguardando Transferência',
  'Inquérito',
  'Liberado',
  'Outro',
];

// Estado inicial do formulário do modal de evento
const eventoInitialState = {
  tipo_evento: 'audiencia',
  data_evento: '', 
  descricao: ''
};

// --- COMPONENTES CUSTOMIZADOS PARA MÁSCARA ---

// Máscara de CPF
const CPFMascara = forwardRef(function CPFMascara(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="000.000.000-00"
      definitions={{ '0': /[0-9]/ }}
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

// Máscara de Processo PJe (20 dígitos)
const ProcessoMascara = forwardRef(function ProcessoMascara(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="0000000-00.0000.0.00.0000"
      definitions={{ '0': /[0-9]/ }}
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

// --- FIM DOS COMPONENTES DE MÁSCARA ---


// --- COMPONENTE PRINCIPAL ---

export function PaginaDetalhes() {
  const { presoId } = useParams();
  const navigate = useNavigate(); // Para redirecionar após deletar
  const [preso, setPreso] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Estados do Modal de Evento ---
  const [modalEventoOpen, setModalEventoOpen] = useState(false);
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState(null);
  const [novoEventoForm, setNovoEventoForm] = useState(eventoInitialState);

  // --- Estados dos Modais de Edição/Delete ---
  const [modalEditarPresoOpen, setModalEditarPresoOpen] = useState(false);
  const [formEditarPreso, setFormEditarPreso] = useState(null);
  
  const [modalEditarProcessoOpen, setModalEditarProcessoOpen] = useState(false);
  const [formEditarProcesso, setFormEditarProcesso] = useState(null);

  const [modalDeletarOpen, setModalDeletarOpen] = useState(false);
  
  // --- Estado do Snackbar ---
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // --- Funções de Busca ---
  const fetchDetalhes = useCallback(async () => {
    // Não mostra o loading de tela cheia se já temos dados (só no recarregamento)
    if (!preso) { 
      setIsLoading(true);
    }
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/presos/${presoId}`);
      setPreso(response.data);
      // Prepara o formulário de edição do preso com os dados recebidos
      setFormEditarPreso({
        nome_completo: response.data.nome_completo,
        cpf: response.data.cpf || '',
        nome_da_mae: response.data.nome_da_mae || '',
        // Formata a data para YYYY-MM-DD (que o input type="date" entende)
        data_nascimento: response.data.data_nascimento ? response.data.data_nascimento.split('T')[0] : '',
      });
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err);
      setError("Não foi possível carregar os detalhes do preso.");
    } finally {
      setIsLoading(false);
    }
  }, [presoId, preso]); // Depende de 'preso' para a lógica de loading

  useEffect(() => {
    fetchDetalhes();
  }, [presoId]); // Roda só quando o ID muda, não no 'fetchDetalhes'

  // --- Handlers de Evento ---
  const handleAbrirModalEvento = (procId) => {
    setProcessoSelecionadoId(procId);
    setNovoEventoForm(eventoInitialState);
    setModalEventoOpen(true);
  };
  const handleFecharModalEvento = () => setModalEventoOpen(false);
  const handleChangeEvento = (e) => {
    setNovoEventoForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSalvarEvento = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/processos/${processoSelecionadoId}/eventos/`, novoEventoForm);
      setSnack({ open: true, message: "Evento adicionado com sucesso!", severity: 'success' });
      handleFecharModalEvento();
      fetchDetalhes(); // Recarrega
    } catch (error) {
      setSnack({ open: true, message: "Erro ao salvar evento.", severity: 'error' });
    }
  };

  // --- Handlers (Editar Preso) ---
  const handleAbrirModalEditarPreso = () => setModalEditarPresoOpen(true);
  const handleFecharModalEditarPreso = () => setModalEditarPresoOpen(false);
  const handleChangeEditarPreso = (e) => {
    setFormEditarPreso(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSalvarEditarPreso = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formEditarPreso,
        cpf: formEditarPreso.cpf ? formEditarPreso.cpf.replace(/[^\d]+/g, '') : null,
        data_nascimento: formEditarPreso.data_nascimento || null, // Garante null se vazio
      };
      await axios.put(`${API_URL}/api/presos/${presoId}`, payload);
      setSnack({ open: true, message: "Dados do preso atualizados!", severity: 'success' });
      handleFecharModalEditarPreso();
      fetchDetalhes(); // Recarrega
    } catch (error) {
      setSnack({ open: true, message: "Erro ao atualizar dados.", severity: 'error' });
    }
  };
  
  // --- Handlers (Editar Processo) ---
  const handleAbrirModalEditarProcesso = (processo) => {
    setFormEditarProcesso({
      ...processo, // Preenche o form com os dados do processo clicado
      data_prisao: processo.data_prisao ? processo.data_prisao.split('T')[0] : '', // Formata data
      numero_processo: processo.numero_processo || '', // Garante que não seja null
      tipo_prisao: processo.tipo_prisao || '',
      status_processual: processo.status_processual || '',
      local_segregacao: processo.local_segregacao || '',
    });
    setModalEditarProcessoOpen(true);
  };
  const handleFecharModalEditarProcesso = () => setModalEditarProcessoOpen(false);
  const handleChangeEditarProcesso = (e) => {
    setFormEditarProcesso(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSalvarEditarProcesso = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formEditarProcesso,
        numero_processo: formEditarProcesso.numero_processo ? formEditarProcesso.numero_processo.replace(/[^\d]+/g, '') : null,
        data_prisao: formEditarProcesso.data_prisao || null, // Garante null se vazio
      };
      await axios.put(`${API_URL}/api/processos/${formEditarProcesso.id}`, payload);
      setSnack({ open: true, message: "Processo atualizado!", severity: 'success' });
      handleFecharModalEditarProcesso();
      fetchDetalhes(); // Recarrega
    } catch (error) {
      setSnack({ open: true, message: "Erro ao atualizar processo.", severity: 'error' });
    }
  };

  // --- Handlers (Deletar Preso) ---
  const handleAbrirModalDeletar = () => setModalDeletarOpen(true);
  const handleFecharModalDeletar = () => setModalDeletarOpen(false);
  const handleConfirmarDelecao = async () => {
    try {
      await axios.delete(`${API_URL}/api/presos/${presoId}`);
      handleFecharModalDeletar();
      // TODO: Mostrar snack de sucesso no dashboard (mais complexo, envolve state/context)
      navigate('/'); // Redireciona para o Dashboard
    } catch (error) {
      setSnack({ open: true, message: "Erro ao deletar.", severity: 'error' });
    }
  };

  // --- Handlers do Snackbar ---
  const handleCloseSnack = () => setSnack(prev => ({ ...prev, open: false }));

  // --- Renderizações de Loading/Erro ---
  if (isLoading && !preso) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!preso) {
    return <Alert severity="warning">Nenhum dado encontrado.</Alert>;
  }

  // --- RENDERIZAÇÃO PRINCIPAL ---
  return (
    <Box>
      {/* 1. Breadcrumbs */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link component={RouterLink} underline="hover" color="inherit" to="/">
          Dashboard
        </Link>
        <Typography color="text.primary">{preso.nome_completo}</Typography>
      </Breadcrumbs>

      {/* 2. Layout Principal (Grid) */}
      <Grid container spacing={3}>
        
        {/* Coluna da Esquerda (Info Pessoal) */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar sx={{ width: 120, height: 120, margin: 'auto', mb: 2 }}>
              <PersonIcon sx={{ fontSize: 80 }} />
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {preso.nome_completo}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              CPF: {preso.cpf || 'Não informado'}
            </Typography>
            
            {/* Tags */}
            {preso.processos && preso.processos[0] && (
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                <Chip label={preso.processos[0].tipo_prisao || 'Tipo N/A'} color="warning" />
                <Chip label={preso.processos[0].status_processual || 'Status N/A'} color="info" />
              </Box>
            )}

            {/* Botões de Ação */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 3, mb: 3 }}>
              <Button 
                variant="contained" 
                startIcon={<EditIcon />}
                onClick={handleAbrirModalEditarPreso}
              >
                Editar Dados Pessoais
              </Button>
              <Button variant="outlined">Exportar Relatório</Button>
              <Button 
                variant="outlined" 
                color="error" 
                startIcon={<DeleteIcon />}
                onClick={handleAbrirModalDeletar}
              >
                Deletar Cadastro
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'left', color: 'text.secondary' }}>
              <Typography variant="body2">
                <strong>Data de Nasc.:</strong> {formatarData(preso.data_nascimento)}
              </Typography>
              <Typography variant="body2">
                <strong>Mãe:</strong> {preso.nome_da_mae || 'Não informado'}
              </Typography>
              <Typography variant="body2">
                <strong>Cadastrado em:</strong> {formatarData(preso.criado_em)}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Coluna da Direita (Processos e Eventos) */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Processos Vinculados ({preso.processos.length})
            </Typography>

            <Box>
              {preso.processos.length > 0 ? preso.processos.map((proc, index) => (
                <Accordion key={proc.id} defaultExpanded={index === 0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <GavelIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                      Processo: {proc.numero_processo}
                    </Typography>
                    {/* Botão Editar Processo */}
                    <Tooltip title="Editar Processo">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation(); // Impede o Accordion de abrir/fechar
                          handleAbrirModalEditarProcesso(proc);
                        }}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: '#f9f9f9' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Status:</strong> {proc.status_processual || 'N/A'}</Typography></Grid>
                      <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Tipo da Prisão:</strong> {proc.tipo_prisao || 'N/A'}</Typography></Grid>
                      <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Data da Prisão:</strong> {formatarData(proc.data_prisao)}</Typography></Grid>
                      <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Local:</strong> {proc.local_segregacao || 'N/A'}</Typography></Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    
                    {/* Área de Eventos */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        Eventos Futuros ({proc.eventos.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => handleAbrirModalEvento(proc.id)}
                      >
                        Adicionar Evento
                      </Button>
                    </Box>

                    {proc.eventos.length > 0 ? proc.eventos.map(evento => (
                       <Paper key={evento.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                         <Typography variant="body2">
                           <strong>{tiposDeEvento[evento.tipo_evento] || evento.tipo_evento}:</strong> {formatarData(evento.data_evento, true)}
                         </Typography>
                         {evento.descricao && <Typography variant="caption" color="text.secondary">{evento.descricao}</Typography>}
                       </Paper>
                    )) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        Nenhum evento futuro cadastrado.
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              )) : (
                <Alert severity="info">Nenhum processo cadastrado para esta pessoa.</Alert>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* --- ÁREA DE MODAIS --- */}

      {/* Modal: Adicionar Evento */}
      <Modal
        open={modalEventoOpen}
        onClose={handleFecharModalEvento}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{ timeout: 500 }}
      >
        <Fade in={modalEventoOpen}>
          <Box sx={styleModal} component="form" onSubmit={handleSalvarEvento}>
            <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Adicionar Novo Evento
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="tipo-evento-label">Tipo de Evento</InputLabel>
                  <Select
                    labelId="tipo-evento-label"
                    name="tipo_evento"
                    value={novoEventoForm.tipo_evento}
                    label="Tipo de Evento"
                    onChange={handleChangeEvento}
                  >
                    {Object.entries(tiposDeEvento).map(([chave, valor]) => (
                      <MenuItem key={chave} value={chave}>{valor}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="data_evento"
                  label="Data e Hora do Evento"
                  type="datetime-local"
                  value={novoEventoForm.data_evento}
                  onChange={handleChangeEvento}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="descricao"
                  label="Descrição (Opcional)"
                  value={novoEventoForm.descricao}
                  onChange={handleChangeEvento}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button onClick={handleFecharModalEvento} variant="text" color="secondary">
                Cancelar
              </Button>
              <Button type="submit" variant="contained">
                Salvar Evento
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      {/* Modal: Editar Preso */}
      {formEditarPreso && (
        <Modal open={modalEditarPresoOpen} onClose={handleFecharModalEditarPreso}>
          <Fade in={modalEditarPresoOpen}>
            <Box sx={styleModal} component="form" onSubmit={handleSalvarEditarPreso}>
              <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                Editar Dados Pessoais
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField name="nome_completo" label="Nome Completo" value={formEditarPreso.nome_completo} onChange={handleChangeEditarPreso} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField name="cpf" label="CPF" value={formEditarPreso.cpf} onChange={handleChangeEditarPreso} fullWidth InputProps={{ inputComponent: CPFMascara }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField name="data_nascimento" label="Data de Nasc." value={formEditarPreso.data_nascimento} onChange={handleChangeEditarPreso} fullWidth type="date" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField name="nome_da_mae" label="Nome da Mãe" value={formEditarPreso.nome_da_mae} onChange={handleChangeEditarPreso} fullWidth />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={handleFecharModalEditarPreso} variant="text" color="secondary">Cancelar</Button>
                <Button type="submit" variant="contained">Salvar Alterações</Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
      )}

      {/* Modal: Editar Processo */}
      {formEditarProcesso && (
        <Modal open={modalEditarProcessoOpen} onClose={handleFecharModalEditarProcesso}>
          <Fade in={modalEditarProcessoOpen}>
            <Box sx={styleModal} component="form" onSubmit={handleSalvarEditarProcesso}>
              <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                Editar Processo
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField name="numero_processo" label="Nº do Processo" value={formEditarProcesso.numero_processo} onChange={handleChangeEditarProcesso} fullWidth required InputProps={{ inputComponent: ProcessoMascara }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth><InputLabel>Tipo da Prisão</InputLabel>
                    <Select name="tipo_prisao" value={formEditarProcesso.tipo_prisao} label="Tipo da Prisão" onChange={handleChangeEditarProcesso}>
                      {opcoesTipoPrisao.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth><InputLabel>Status Processual</InputLabel>
                    <Select name="status_processual" value={formEditarProcesso.status_processual} label="Status Processual" onChange={handleChangeEditarProcesso}>
                      {opcoesStatusProcessual.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField name="data_prisao" label="Data da Prisão" value={formEditarProcesso.data_prisao} onChange={handleChangeEditarProcesso} fullWidth type="date" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField name="local_segregacao" label="Local de Segregação" value={formEditarProcesso.local_segregacao} onChange={handleChangeEditarProcesso} fullWidth />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={handleFecharModalEditarProcesso} variant="text" color="secondary">Cancelar</Button>
                <Button type="submit" variant="contained">Salvar Alterações</Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
      )}

      {/* Modal: Confirmação de Deleção */}
      <Dialog
        open={modalDeletarOpen}
        onClose={handleFecharModalDeletar}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você tem certeza que deseja deletar o cadastro de <strong>{preso.nome_completo}</strong>?
            <br/><br/>
            Esta ação é irreversível e irá apagar todos os processos e eventos associados.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleFecharModalDeletar} color="secondary">Cancelar</Button>
          <Button onClick={handleConfirmarDelecao} variant="contained" color="error" autoFocus>
            Confirmar Exclusão
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar (Alerta de Feedback) */}
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