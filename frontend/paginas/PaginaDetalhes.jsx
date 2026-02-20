import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import api from '../src/api';
import { formatarData } from '../src/util/formatarData';
import { tiposDeEvento } from '../src/util/tiposEvento';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PainelInfoPreso } from '../src/componentes/detalhes/PainelInfoPreso';
import { ListaProcessos } from '../src/componentes/detalhes/ListaProcessos';
import {
  Box, Typography, Grid, CircularProgress, Alert,
  Breadcrumbs, Link, Button,
  Modal, Fade, Backdrop, TextField, FormControl,
  InputLabel, Select, MenuItem, Snackbar, Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { IMaskInput } from 'react-imask'; // Importa a máscara

// Ícones
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

// --- CONSTANTES E HELPERS ---

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
  const [eventoEditandoId, setEventoEditandoId] = useState(null);
  const [novoEventoForm, setNovoEventoForm] = useState(eventoInitialState);

  // --- Estados dos Modais de Edição/Delete ---
  const [modalEditarPresoOpen, setModalEditarPresoOpen] = useState(false);
  const [formEditarPreso, setFormEditarPreso] = useState(null);

  const [modalEditarProcessoOpen, setModalEditarProcessoOpen] = useState(false);
  const [formEditarProcesso, setFormEditarProcesso] = useState(null);

  const [modalDeletarOpen, setModalDeletarOpen] = useState(false);
  const [modalDeletarEventoOpen, setModalDeletarEventoOpen] = useState(false);
  const [eventoParaDeletarId, setEventoParaDeletarId] = useState(null);

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
      const response = await api.get(`/api/presos/${presoId}`);
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
  const handleFecharModalEvento = () => {
    setModalEventoOpen(false);
    setEventoEditandoId(null);
  };
  const handleChangeEvento = (e) => {
    setNovoEventoForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSalvarEvento = async (e) => {
    e.preventDefault();
    try {
      if (eventoEditandoId) {
        await api.put(`/api/eventos/${eventoEditandoId}`, novoEventoForm);
        setSnack({ open: true, message: "Evento atualizado com sucesso!", severity: 'success' });
      } else {
        await api.post(`/api/processos/${processoSelecionadoId}/eventos/`, novoEventoForm);
        setSnack({ open: true, message: "Evento adicionado com sucesso!", severity: 'success' });
      }
      handleFecharModalEvento();
      fetchDetalhes(); // Recarrega
    } catch (error) {
      setSnack({ open: true, message: "Erro ao salvar evento.", severity: 'error' });
    }
  };

  const handleAbrirEdicaoEvento = (evento, processoId) => {
    setProcessoSelecionadoId(processoId);
    setEventoEditandoId(evento.id);
    setNovoEventoForm({
      tipo_evento: evento.tipo_evento,
      data_evento: evento.data_evento ? evento.data_evento.substring(0, 16) : '',
      descricao: evento.descricao || ''
    });
    setModalEventoOpen(true);
  };

  const handleDeletarEvento = (eventoId) => {
    setEventoParaDeletarId(eventoId);
    setModalDeletarEventoOpen(true);
  };

  const handleConfirmarDelecaoEvento = async () => {
    try {
      await api.delete(`/api/eventos/${eventoParaDeletarId}`);
      setSnack({ open: true, message: "Evento excluído com sucesso!", severity: 'success' });
      setModalDeletarEventoOpen(false);
      fetchDetalhes();
    } catch (error) {
      setSnack({ open: true, message: "Erro ao excluir evento.", severity: 'error' });
    }
  };

  const handleFecharModalDeletarEvento = () => {
    setModalDeletarEventoOpen(false);
    setEventoParaDeletarId(null);
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
      await api.put(`/api/presos/${presoId}`, payload);
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
      numero_da_guia: processo.numero_da_guia || '',
      tipo_guia: processo.tipo_guia || '',
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
      await api.put(`/api/processos/${formEditarProcesso.id}`, payload);
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
      await api.delete(`/api/presos/${presoId}`);
      handleFecharModalDeletar();
      // TODO: Mostrar snack de sucesso no dashboard (mais complexo, envolve state/context)
      navigate('/'); // Redireciona para o Dashboard
    } catch (error) {
      setSnack({ open: true, message: "Erro ao deletar.", severity: 'error' });
    }
  };

  const handleExportarRelatorio = () => {
    if (!preso) {
      setSnack({ open: true, message: 'Nenhum dado disponível para exportação.', severity: 'warning' });
      return;
    }

    const linhas = [
      ['Tipo', 'Campo', 'Valor'],
      ['Preso', 'Nome Completo', preso.nome_completo || ''],
      ['Preso', 'CPF', preso.cpf || ''],
      ['Preso', 'Nome da Mãe', preso.nome_da_mae || ''],
      ['Preso', 'Data de Nascimento', preso.data_nascimento || ''],
      ['Preso', 'Criado em', preso.criado_em || ''],
    ];

    (preso.processos || []).forEach((processo, index) => {
      const processoLabel = `Processo ${index + 1}`;
      linhas.push([processoLabel, 'Número', processo.numero_processo || '']);
      linhas.push([processoLabel, 'Status', processo.status_processual || '']);
      linhas.push([processoLabel, 'Tipo de Prisão', processo.tipo_prisao || '']);
      linhas.push([processoLabel, 'Data da Prisão', processo.data_prisao || '']);
      linhas.push([processoLabel, 'Local de Segregação', processo.local_segregacao || '']);

      (processo.eventos || []).forEach((evento, eventoIndex) => {
        const eventoLabel = `${processoLabel} - Evento ${eventoIndex + 1}`;
        linhas.push([eventoLabel, 'Tipo', tiposDeEvento[evento.tipo_evento] || evento.tipo_evento || '']);
        linhas.push([eventoLabel, 'Data', evento.data_evento || '']);
        linhas.push([eventoLabel, 'Status do Alerta', evento.alerta_status || '']);
        linhas.push([eventoLabel, 'Descrição', evento.descricao || '']);
      });
    });

    const escapeCsv = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const csvContent = "\uFEFF" + linhas.map((linha) => linha.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const nomeSeguro = (preso.nome_completo || 'preso').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '_');
    const fileName = `relatorio_${nomeSeguro}_${new Date().toISOString().slice(0, 10)}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSnack({ open: true, message: 'Relatório exportado com sucesso.', severity: 'success' });
  };

  const handleExportarPDF = () => {
    if (!preso) {
      setSnack({ open: true, message: 'Nenhum dado disponível para exportação.', severity: 'warning' });
      return;
    }

    const doc = new jsPDF();
    autoTable(doc, {
      didDrawPage: function (data) {
        // ...
      }
    }); // Mock init to get types right if needed
    // Configurações e Título
    doc.setFontSize(16);
    doc.text(`Relatório do Preso: ${preso.nome_completo || 'N/A'}`, 14, 20);

    doc.setFontSize(12);
    doc.text(`CPF: ${preso.cpf || 'Não informado'}`, 14, 28);
    doc.text(`Mãe: ${preso.nome_da_mae || 'Não informado'}`, 14, 34);
    doc.text(`Data de Nascimento: ${preso.data_nascimento ? formatarData(preso.data_nascimento) : 'Não informada'}`, 14, 40);

    let startY = 50;

    (preso.processos || []).forEach((processo, index) => {
      doc.setFontSize(14);
      doc.text(`Processo ${index + 1}: ${processo.numero_processo || 'S/N'}`, 14, startY);
      startY += 8;

      const processoDados = [
        ['Status', processo.status_processual || ''],
        ['Tipo de Prisão', processo.tipo_prisao || ''],
        ['Data da Prisão', processo.data_prisao ? formatarData(processo.data_prisao) : ''],
        ['Local', processo.local_segregacao || '']
      ];

      autoTable(doc, {
        startY: startY,
        head: [['Campo', 'Valor']],
        body: processoDados,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 14 }
      });

      startY = doc.lastAutoTable.finalY + 10;

      if (processo.eventos && processo.eventos.length > 0) {
        doc.setFontSize(12);
        doc.text('Eventos do Processo:', 14, startY);
        startY += 6;

        const eventosDados = processo.eventos.map(evento => [
          tiposDeEvento[evento.tipo_evento] || evento.tipo_evento || '',
          evento.data_evento ? formatarData(evento.data_evento, true) : '',
          evento.alerta_status || '',
          evento.descricao || ''
        ]);

        autoTable(doc, {
          startY: startY,
          head: [['Tipo', 'Data', 'Status', 'Descrição']],
          body: eventosDados,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          margin: { left: 14 }
        });

        startY = doc.lastAutoTable.finalY + 15;
      } else {
        startY += 5;
      }
    });

    const nomeSeguro = (preso.nome_completo || 'preso').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '_');
    doc.save(`relatorio_${nomeSeguro}.pdf`);

    setSnack({ open: true, message: 'Relatório em PDF exportado com sucesso.', severity: 'success' });
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

      {/* 2. Layout Principal (Grid CSS robusto) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 2.5fr' },
          gap: 3,
          alignItems: 'start'
        }}
      >

        {/* Coluna da Esquerda (Info Pessoal) */}
        <Box sx={{ minWidth: 0 }}>
          <PainelInfoPreso
            preso={preso}
            formatarData={formatarData}
            onEditar={handleAbrirModalEditarPreso}
            onDeletar={handleAbrirModalDeletar}
            onExportar={handleExportarRelatorio}
            onExportarPDF={handleExportarPDF}
          />
        </Box>

        {/* Coluna da Direita (Processos e Eventos) */}
        <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
          <ListaProcessos
            processos={preso.processos}
            formatarData={formatarData}
            tiposDeEvento={tiposDeEvento}
            onEditarProcesso={handleAbrirModalEditarProcesso}
            onAbrirEvento={handleAbrirModalEvento}
            onEditarEvento={handleAbrirEdicaoEvento}
            onDeletarEvento={handleDeletarEvento}
          />
        </Box>
      </Box>

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
              {eventoEditandoId ? "Editar Evento" : "Adicionar Novo Evento"}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 2,
                mt: 1
              }}
            >
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

              <TextField
                name="descricao"
                label="Descrição (Opcional)"
                value={novoEventoForm.descricao}
                onChange={handleChangeEvento}
                fullWidth
                multiline
                rows={3}
              />
            </Box>
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
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  mt: 1
                }}
              >
                <TextField
                  name="nome_completo"
                  label="Nome Completo"
                  value={formEditarPreso.nome_completo}
                  onChange={handleChangeEditarPreso}
                  fullWidth
                  required
                  sx={{ gridColumn: '1 / -1' }}
                />
                <TextField name="cpf" label="CPF" value={formEditarPreso.cpf} onChange={handleChangeEditarPreso} fullWidth InputProps={{ inputComponent: CPFMascara }} />
                <TextField name="data_nascimento" label="Data de Nasc." value={formEditarPreso.data_nascimento} onChange={handleChangeEditarPreso} fullWidth type="date" InputLabelProps={{ shrink: true }} />
                <TextField name="nome_da_mae" label="Nome da Mãe" value={formEditarPreso.nome_da_mae} onChange={handleChangeEditarPreso} fullWidth sx={{ gridColumn: '1 / -1' }} />
              </Box>
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
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 2,
                  mt: 1
                }}
              >
                <TextField name="numero_processo" label="Nº do Processo" value={formEditarProcesso.numero_processo} onChange={handleChangeEditarProcesso} fullWidth required InputProps={{ inputComponent: ProcessoMascara }} />

                <FormControl fullWidth><InputLabel>Tipo da Prisão</InputLabel>
                  <Select name="tipo_prisao" value={formEditarProcesso.tipo_prisao} label="Tipo da Prisão" onChange={handleChangeEditarProcesso}>
                    {opcoesTipoPrisao.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                  </Select>
                </FormControl>

                <Autocomplete
                  freeSolo
                  options={opcoesStatusProcessual}
                  value={formEditarProcesso.status_processual || ''}
                  onChange={(event, newValue) => {
                    setFormEditarProcesso(prev => ({ ...prev, status_processual: newValue }));
                  }}
                  onInputChange={(event, newInputValue) => {
                    setFormEditarProcesso(prev => ({ ...prev, status_processual: newInputValue }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Status Processual" variant="outlined" />
                  )}
                  fullWidth
                />

                <TextField name="data_prisao" label="Data da Prisão" value={formEditarProcesso.data_prisao} onChange={handleChangeEditarProcesso} fullWidth type="date" InputLabelProps={{ shrink: true }} />

                <TextField name="local_segregacao" label="Local de Segregação" value={formEditarProcesso.local_segregacao} onChange={handleChangeEditarProcesso} fullWidth />

                <TextField name="numero_da_guia" label="Número da Guia (Opcional)" value={formEditarProcesso.numero_da_guia || ''} onChange={handleChangeEditarProcesso} fullWidth />

                <FormControl fullWidth><InputLabel>Tipo de Guia (Opcional)</InputLabel>
                  <Select name="tipo_guia" value={formEditarProcesso.tipo_guia || ''} label="Tipo de Guia (Opcional)" onChange={handleChangeEditarProcesso}>
                    <MenuItem value=""><em>Nenhuma</em></MenuItem>
                    <MenuItem value="Provisória">Provisória</MenuItem>
                    <MenuItem value="Definitiva">Definitiva</MenuItem>
                  </Select>
                </FormControl>
              </Box>
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
            <br /><br />
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

      {/* Modal: Confirmação de Deleção de Evento */}
      <Dialog
        open={modalDeletarEventoOpen}
        onClose={handleFecharModalDeletarEvento}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirmar Exclusão de Evento</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você tem certeza que deseja excluir permanentemente este evento?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleFecharModalDeletarEvento} color="secondary">Cancelar</Button>
          <Button onClick={handleConfirmarDelecaoEvento} variant="contained" color="error" autoFocus>
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