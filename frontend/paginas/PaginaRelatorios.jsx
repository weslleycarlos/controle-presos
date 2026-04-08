import React, { useState } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, MenuItem, Button,
  Snackbar, Alert, CircularProgress, Divider
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ClearIcon from '@mui/icons-material/Clear';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../src/api';
import { formatarData } from '../src/util/formatarData';
import { tiposDeEvento } from '../src/util/tiposEvento';

const STATUS_OPCOES = [
  'Preso Preventivo',
  'Preso Definitivo',
  'Preso Temporário',
  'Aguardando Julgamento',
  'Condenado',
  'Liberdade Provisória',
];

const SNACK_INICIAL = { open: false, message: '', severity: 'info' };

export function PaginaRelatorios() {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataPrisao, setFiltroDataPrisao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [snack, setSnack] = useState(SNACK_INICIAL);

  const fecharSnack = () => setSnack(SNACK_INICIAL);

  const limparFiltros = () => {
    setFiltroNome('');
    setFiltroStatus('');
    setFiltroDataPrisao('');
  };

  const gerarPDF = async () => {
    setCarregando(true);
    try {
      const params = {};
      if (filtroNome.trim()) params.nome = filtroNome.trim();
      if (filtroStatus) params.status_processual = filtroStatus;
      if (filtroDataPrisao) params.data_prisao = filtroDataPrisao;

      const { data: presos } = await api.get('/api/relatorios/completo', { params });

      if (!presos || presos.length === 0) {
        setSnack({ open: true, message: 'Nenhum cadastro encontrado com os filtros informados.', severity: 'warning' });
        return;
      }

      const doc = new jsPDF();
      const dataGeracao = new Date().toLocaleString('pt-BR');

      // --- Cabeçalho do relatório ---
      doc.setFontSize(16);
      doc.text('Relatório Completo de Cadastros', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${dataGeracao}`, 14, 25);
      doc.text(`Total de registros: ${presos.length}`, 14, 31);
      doc.setTextColor(0);

      let startY = 40;

      presos.forEach((preso, idx) => {
        // Quebra de página se necessário
        if (startY > 250) {
          doc.addPage();
          startY = 20;
        }

        // --- Dados pessoais ---
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(`${idx + 1}. ${preso.nome_completo || 'N/A'}`, 14, startY);
        doc.setFont(undefined, 'normal');
        startY += 7;

        doc.setFontSize(10);
        doc.text(`CPF: ${preso.cpf || 'Não informado'}`, 14, startY);
        startY += 5;
        doc.text(`Nome da mãe: ${preso.nome_da_mae || 'Não informado'}`, 14, startY);
        startY += 5;
        doc.text(`Data de nascimento: ${preso.data_nascimento ? formatarData(preso.data_nascimento) : 'Não informada'}`, 14, startY);
        startY += 8;

        const processos = preso.processos || [];

        if (processos.length === 0) {
          doc.setFontSize(9);
          doc.setTextColor(130);
          doc.text('Nenhum processo cadastrado.', 14, startY);
          doc.setTextColor(0);
          startY += 8;
        }

        processos.forEach((processo, pIdx) => {
          if (startY > 250) {
            doc.addPage();
            startY = 20;
          }

          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.text(`Processo ${pIdx + 1}: ${processo.numero_processo || 'S/N'}`, 14, startY);
          doc.setFont(undefined, 'normal');
          startY += 5;

          autoTable(doc, {
            startY,
            head: [['Campo', 'Valor']],
            body: [
              ['Status Processual', processo.status_processual || ''],
              ['Tipo de Prisão', processo.tipo_prisao || ''],
              ['Data da Prisão', processo.data_prisao ? formatarData(processo.data_prisao) : ''],
              ['Local de Segregação', processo.local_segregacao || ''],
              ['Número da Guia', processo.numero_da_guia || ''],
              ['Tipo da Guia', processo.tipo_guia || ''],
            ],
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14 },
            styles: { fontSize: 9 },
          });

          startY = doc.lastAutoTable.finalY + 6;

          const eventos = processo.eventos || [];
          if (eventos.length > 0) {
            if (startY > 250) {
              doc.addPage();
              startY = 20;
            }

            doc.setFontSize(10);
            doc.text('Eventos:', 14, startY);
            startY += 4;

            autoTable(doc, {
              startY,
              head: [['Tipo', 'Data', 'Status', 'Descrição']],
              body: eventos.map(ev => [
                tiposDeEvento[ev.tipo_evento] || ev.tipo_evento || '',
                ev.data_evento ? formatarData(ev.data_evento, true) : '',
                ev.alerta_status || '',
                ev.descricao || '',
              ]),
              theme: 'grid',
              headStyles: { fillColor: [100, 100, 100] },
              margin: { left: 14 },
              styles: { fontSize: 9 },
            });

            startY = doc.lastAutoTable.finalY + 8;
          } else {
            startY += 4;
          }
        });

        // Separador entre presos
        if (idx < presos.length - 1) {
          if (startY > 260) {
            doc.addPage();
            startY = 20;
          } else {
            doc.setDrawColor(200);
            doc.line(14, startY, 196, startY);
            startY += 8;
          }
        }
      });

      const dataHoje = new Date().toISOString().slice(0, 10);
      doc.save(`relatorio_completo_${dataHoje}.pdf`);
      setSnack({ open: true, message: `Relatório gerado com sucesso (${presos.length} registro(s)).`, severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Erro ao gerar o relatório. Tente novamente.', severity: 'error' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Relatórios
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Gere relatórios em PDF com informações de todos os cadastros.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Relatório Completo de Cadastros
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Filtrar por nome"
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              label="Status processual"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">Todos</MenuItem>
              {STATUS_OPCOES.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Data de prisão"
              type="date"
              value={filtroDataPrisao}
              onChange={e => setFiltroDataPrisao(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={carregando ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={gerarPDF}
              disabled={carregando}
            >
              {carregando ? 'Gerando...' : 'Gerar Relatório PDF'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={limparFiltros}
              disabled={carregando}
            >
              Limpar Filtros
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={fecharSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={fecharSnack} severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
