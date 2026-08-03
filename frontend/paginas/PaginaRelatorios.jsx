import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, MenuItem, Button,
  Snackbar, Alert, CircularProgress, Divider
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import ClearIcon from '@mui/icons-material/Clear';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import writeXlsxFile, { getSheetData } from 'write-excel-file/browser';
import api from '../src/api';
import { formatarData } from '../src/util/formatarData';
import { tiposDeEvento } from '../src/util/tiposEvento';
import { extractErrorMessage } from '../src/util/apiError';

const SNACK_INICIAL = { open: false, message: '', severity: 'info' };

export function PaginaRelatorios() {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataPrisao, setFiltroDataPrisao] = useState('');
  const [statusOpcoes, setStatusOpcoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoExcel, setCarregandoExcel] = useState(false);
  const [snack, setSnack] = useState(SNACK_INICIAL);

  const fecharSnack = () => setSnack(SNACK_INICIAL);

  // Os status são digitados livremente no cadastro; a lista vem do banco.
  useEffect(() => {
    const buscarStatus = async () => {
      try {
        const { data } = await api.get('/api/presos/status-processuais');
        setStatusOpcoes(data);
      } catch (error) {
        console.error('Erro ao buscar status processuais:', error);
      }
    };
    buscarStatus();
  }, []);

  const limparFiltros = () => {
    setFiltroNome('');
    setFiltroStatus('');
    setFiltroDataPrisao('');
  };

  /** Busca os dados do relatório aplicando os filtros da tela. */
  const buscarPresos = async () => {
    const params = {};
    if (filtroNome.trim()) params.nome = filtroNome.trim();
    if (filtroStatus) params.status_processual = filtroStatus;
    if (filtroDataPrisao) params.data_prisao = filtroDataPrisao;

    const { data } = await api.get('/api/relatorios/completo', { params });
    return data || [];
  };

  const gerarExcel = async () => {
    setCarregandoExcel(true);
    try {
      const presos = await buscarPresos();

      if (presos.length === 0) {
        setSnack({ open: true, message: 'Nenhum cadastro encontrado com os filtros informados.', severity: 'warning' });
        return;
      }

      // Uma linha por processo (planilha fica filtrável e dinamizável).
      // Presos sem processo ainda aparecem, com as colunas de processo vazias.
      const linhasCadastros = [];
      const linhasEventos = [];

      presos.forEach((preso) => {
        const processos = preso.processos || [];

        if (processos.length === 0) {
          linhasCadastros.push({ preso, processo: null });
        }

        processos.forEach((processo) => {
          linhasCadastros.push({ preso, processo });
          (processo.eventos || []).forEach((evento) => {
            linhasEventos.push({ preso, processo, evento });
          });
        });
      });

      const texto = (valor) => valor || '';
      const dataCelula = (valor, formato) => {
        if (!valor) return null;
        const data = new Date(valor);
        if (Number.isNaN(data.getTime())) return null;
        return { value: data, type: Date, format: formato };
      };
      const cabecalho = (titulo) => ({
        value: titulo,
        fontWeight: 'bold',
        backgroundColor: '#E8EAF6',
      });

      const colunasCadastros = [
        { header: cabecalho('Nome'), width: 32, cell: (l) => texto(l.preso.nome_completo) },
        { header: cabecalho('CPF'), width: 15, cell: (l) => texto(l.preso.cpf) },
        { header: cabecalho('Nome da mãe'), width: 32, cell: (l) => texto(l.preso.nome_da_mae) },
        { header: cabecalho('Data de nascimento'), width: 18, cell: (l) => dataCelula(l.preso.data_nascimento, 'dd/mm/yyyy') },
        { header: cabecalho('Nº do processo'), width: 24, cell: (l) => texto(l.processo?.numero_processo) },
        { header: cabecalho('Status processual'), width: 24, cell: (l) => texto(l.processo?.status_processual) },
        { header: cabecalho('Tipo de prisão'), width: 20, cell: (l) => texto(l.processo?.tipo_prisao) },
        { header: cabecalho('Data da prisão'), width: 16, cell: (l) => dataCelula(l.processo?.data_prisao, 'dd/mm/yyyy') },
        { header: cabecalho('Local de segregação'), width: 28, cell: (l) => texto(l.processo?.local_segregacao) },
        { header: cabecalho('Nº da guia'), width: 16, cell: (l) => texto(l.processo?.numero_da_guia) },
        { header: cabecalho('Tipo da guia'), width: 16, cell: (l) => texto(l.processo?.tipo_guia) },
        { header: cabecalho('Qtd. de eventos'), width: 16, cell: (l) => ({ value: (l.processo?.eventos || []).length, type: Number }) },
      ];

      const colunasEventos = [
        { header: cabecalho('Nome'), width: 32, cell: (l) => texto(l.preso.nome_completo) },
        { header: cabecalho('Nº do processo'), width: 24, cell: (l) => texto(l.processo.numero_processo) },
        { header: cabecalho('Tipo de evento'), width: 24, cell: (l) => texto(tiposDeEvento[l.evento.tipo_evento] || l.evento.tipo_evento) },
        { header: cabecalho('Data do evento'), width: 20, cell: (l) => dataCelula(l.evento.data_evento, 'dd/mm/yyyy hh:mm') },
        { header: cabecalho('Status do alerta'), width: 18, cell: (l) => texto(l.evento.alerta_status) },
        { header: cabecalho('Descrição'), width: 50, cell: (l) => texto(l.evento.descricao) },
      ];

      // Cada aba é montada com getSheetData(objetos, colunas); a primeira linha
      // fica congelada para o cabeçalho continuar visível ao rolar.
      const abas = [{
        sheet: 'Cadastros',
        data: getSheetData(linhasCadastros, colunasCadastros),
        columns: colunasCadastros.map(({ width }) => ({ width })),
        stickyRowsCount: 1,
      }];

      // A aba de eventos só entra se houver eventos: aba vazia confunde.
      if (linhasEventos.length > 0) {
        abas.push({
          sheet: 'Eventos',
          data: getSheetData(linhasEventos, colunasEventos),
          columns: colunasEventos.map(({ width }) => ({ width })),
          stickyRowsCount: 1,
        });
      }

      const dataHoje = new Date().toISOString().slice(0, 10);

      // writeXlsxFile() apenas prepara a geração e devolve um objeto; é o
      // .toFile() que monta a planilha e dispara o download.
      await writeXlsxFile(abas).toFile(`relatorio_completo_${dataHoje}.xlsx`);

      setSnack({
        open: true,
        message: `Planilha gerada com sucesso (${presos.length} cadastro(s), ${linhasCadastros.length} linha(s)).`,
        severity: 'success',
      });
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        message: extractErrorMessage(err, 'Erro ao gerar a planilha. Tente novamente.'),
        severity: 'error',
      });
    } finally {
      setCarregandoExcel(false);
    }
  };

  const gerarPDF = async () => {
    setCarregando(true);
    try {
      const presos = await buscarPresos();

      if (presos.length === 0) {
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
            body: [
              ['Status Processual', processo.status_processual || ''],
              ['Tipo de Prisão', processo.tipo_prisao || ''],
              ['Data da Prisão', processo.data_prisao ? formatarData(processo.data_prisao) : ''],
              ['Local de Segregação', processo.local_segregacao || ''],
              ['Número da Guia', processo.numero_da_guia || ''],
              ['Tipo da Guia', processo.tipo_guia || ''],
            ],
            theme: 'striped',
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
      setSnack({
        open: true,
        message: extractErrorMessage(err, 'Erro ao gerar o relatório. Tente novamente.'),
        severity: 'error',
      });
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
        Gere relatórios com informações de todos os cadastros: PDF formatado para
        leitura e impressão, ou planilha Excel para filtrar e analisar os dados.
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
              {statusOpcoes.map(s => (
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
              disabled={carregando || carregandoExcel}
            >
              {carregando ? 'Gerando...' : 'Gerar Relatório PDF'}
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={carregandoExcel ? <CircularProgress size={18} color="inherit" /> : <TableViewIcon />}
              onClick={gerarExcel}
              disabled={carregando || carregandoExcel}
            >
              {carregandoExcel ? 'Gerando...' : 'Exportar Excel'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={limparFiltros}
              disabled={carregando || carregandoExcel}
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
