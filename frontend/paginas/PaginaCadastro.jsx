import React, { useState, forwardRef } from 'react';
import api from '../src/api';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, FormHelperText, Autocomplete
} from '@mui/material';
import { IMaskInput } from 'react-imask'; // Importa a máscara
import { validarCPF } from '../src/util/cpfValidator'; // Importa nosso validador

// --- Componentes Customizados para Máscara ---
// Precisamos "ensinar" o MUI a usar o IMaskInput

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
// --- Fim dos Componentes de Máscara ---


// Opções para os campos Select
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

const initialState = {
  nome_completo: '',
  cpf: '',
  nome_da_mae: '',
  data_nascimento: null,
  numero_processo: '',
  tipo_prisao: '',
  status_processual: '',
  data_prisao: null,
  local_segregacao: '',
  numero_da_guia: '',
  tipo_guia: '',
};

export function PaginaCadastro() {
  const [form, setForm] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [isConsultandoProcesso, setIsConsultandoProcesso] = useState(false);
  const [isConsultandoCpf, setIsConsultandoCpf] = useState(false);
  const [ultimoCpfConsultado, setUltimoCpfConsultado] = useState(null);
  const [cpfError, setCpfError] = useState(false); // Estado para o erro do CPF

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const consultarCpfIntegracao = async (cpfNumerico) => {
    if (!cpfNumerico || cpfNumerico.length !== 11) {
      return;
    }

    setIsConsultandoCpf(true);
    try {
      const response = await api.post('/api/integracoes/cpf/consultar', { cpf: cpfNumerico });
      setUltimoCpfConsultado(cpfNumerico);

      if (!response.data?.sucesso || !response.data?.dados) {
        return;
      }

      const dados = response.data.dados;
      setForm((prev) => ({
        ...prev,
        nome_completo: prev.nome_completo || dados.nome_completo || prev.nome_completo,
        nome_da_mae: prev.nome_da_mae || dados.nome_da_mae || prev.nome_da_mae,
        data_nascimento: prev.data_nascimento || dados.data_nascimento || prev.data_nascimento,
      }));

      setSnack({ open: true, message: 'Dados pessoais preenchidos via integração de CPF.', severity: 'success' });
    } catch {
      // Não bloqueia o cadastro manual quando a integração falhar.
    } finally {
      setIsConsultandoCpf(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Validação de CPF em tempo real
    if (name === 'cpf') {
      const soNumeros = value.replace(/[^\d]+/g, '');
      if (soNumeros.length === 11) {
        const cpfValido = validarCPF(soNumeros);
        setCpfError(!cpfValido); // Se não for válido, cpfError = true

        if (cpfValido && soNumeros !== ultimoCpfConsultado && !isConsultandoCpf) {
          consultarCpfIntegracao(soNumeros);
        }
      } else {
        setCpfError(false); // Limpa o erro se não tiver 11 dígitos
      }
    }

    // Atualiza o estado
    setForm(prev => ({
      ...prev,
      [name]: (value === '' ? null : value) // Salva null se o campo for limpo
    }));
  };

  const handleCloseSnack = () => {
    setSnack(prev => ({ ...prev, open: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verifica a validação do CPF antes de enviar
    if (form.cpf && cpfError) {
      setSnack({ open: true, message: 'CPF inválido. Por favor, corrija.', severity: 'error' });
      return;
    }

    setIsSaving(true);

    // Prepara o payload, removendo máscaras
    const payload = {
      preso: {
        nome_completo: form.nome_completo,
        cpf: form.cpf ? form.cpf.replace(/[^\d]+/g, '') : null, // Envia só números
        nome_da_mae: form.nome_da_mae,
        data_nascimento: form.data_nascimento,
      },
      processos: [
        {
          numero_processo: form.numero_processo ? form.numero_processo.replace(/[^\d]+/g, '') : null, // Envia só números
          tipo_prisao: form.tipo_prisao,
          status_processual: form.status_processual,
          data_prisao: form.data_prisao,
          local_segregacao: form.local_segregacao,
          numero_da_guia: form.numero_da_guia,
          tipo_guia: form.tipo_guia,
        }
      ]
    };

    try {
      const response = await api.post('/api/cadastro-completo', payload);
      setSnack({ open: true, message: `Preso '${response.data.nome_completo}' cadastrado com sucesso!`, severity: 'success' });
      setForm(initialState); // Limpa o formulário

      // *** MUDANÇA IMPORTANTE ***
      // Removemos o redirecionamento automático. O usuário verá o sucesso
      // e pode decidir cadastrar outro ou navegar pelo menu.
      // setTimeout(() => navigate('/'), 2000); // <- REMOVIDO

    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      let errorMsg = 'Erro ao salvar. Verifique os campos.';
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      setSnack({ open: true, message: errorMsg, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBuscarIntegracaoProcesso = async () => {
    if (!form.numero_processo) {
      setSnack({ open: true, message: 'Informe o número do processo para consultar.', severity: 'warning' });
      return;
    }

    setIsConsultandoProcesso(true);
    try {
      const response = await api.post('/api/integracoes/processos/consultar', {
        numero_processo: form.numero_processo,
        fontes: ['datajud', 'pje'],
      });

      const dados = response.data?.melhor_resultado;
      if (!dados) {
        setSnack({ open: true, message: 'Nenhum dado encontrado nas integrações externas.', severity: 'info' });
        return;
      }

      const processo = dados.processo || dados;
      setForm((prev) => ({
        ...prev,
        numero_processo: processo.numero_processo || prev.numero_processo,
        status_processual: processo.status_processual || prev.status_processual,
        tipo_prisao: processo.tipo_prisao || prev.tipo_prisao,
        data_prisao: processo.data_prisao || prev.data_prisao,
        local_segregacao: processo.local_segregacao || prev.local_segregacao,
      }));

      setSnack({ open: true, message: 'Dados do processo carregados da integração.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: error.response?.data?.detail || 'Falha ao consultar integração externa.',
        severity: 'error'
      });
    } finally {
      setIsConsultandoProcesso(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: 'text.primary', mb: 3 }}>
        Novo Cadastro de Preso
      </Typography>

      {/* *** MUDANÇA NO LAYOUT ***
          Usando 'display: grid' para o layout de 2 colunas que você gostou.
          Ele será 1 coluna (xs) em telas pequenas e 2 colunas (sm) em maiores.
      */}
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 4,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3
        }}
      >

        {/* Título da Seção 1 */}
        <Typography variant="h6" sx={{ gridColumn: '1 / -1', mb: -1 }}>
          1. Dados Pessoais
        </Typography>

        <TextField
          name="nome_completo"
          label="Nome Completo"
          value={form.nome_completo || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
          required
          sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }} // Ocupa 2 colunas
        />
        <TextField
          name="cpf"
          label="CPF"
          value={form.cpf || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
          required
          error={cpfError} // Ativa o estado de erro
          helperText={cpfError ? 'CPF inválido' : ''} // Mensagem de ajuda
          InputProps={{
            inputComponent: CPFMascara, // Aplica a máscara
          }}
          disabled={isConsultandoCpf}
        />
        <TextField
          name="nome_da_mae"
          label="Nome da Mãe"
          value={form.nome_da_mae || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />
        <TextField
          name="data_nascimento"
          label="Data de Nascimento"
          value={form.data_nascimento || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
          type="date"
          InputLabelProps={{ shrink: true }}
        />

        {/* Espaçador */}
        <Box sx={{ gridColumn: '1 / -1', height: '16px' }} />

        {/* Título da Seção 2 */}
        <Typography variant="h6" sx={{ gridColumn: '1 / -1', mb: -1 }}>
          2. Dados do Processo e Prisão
        </Typography>

        <TextField
          name="numero_processo"
          label="Número do Processo (PJe)"
          value={form.numero_processo || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
          required
          sx={{ gridColumn: '1 / -1' }} // Ocupa 2 colunas
          InputProps={{
            inputComponent: ProcessoMascara, // Aplica a máscara
          }}
        />
        <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            type="button"
            variant="outlined"
            onClick={handleBuscarIntegracaoProcesso}
            disabled={isConsultandoProcesso || !form.numero_processo}
          >
            {isConsultandoProcesso ? 'Consultando integrações...' : 'Buscar dados no PJe/DataJud'}
          </Button>
        </Box>

        {/* --- CAMPO SELECT (Tipo de Prisão) --- */}
        <FormControl fullWidth>
          <InputLabel id="tipo-prisao-label">Tipo da Prisão</InputLabel>
          <Select
            labelId="tipo-prisao-label"
            id="tipo_prisao"
            name="tipo_prisao"
            value={form.tipo_prisao || ''}
            label="Tipo da Prisão"
            onChange={handleChange}
          >
            {opcoesTipoPrisao.map((opcao) => (
              <MenuItem key={opcao} value={opcao}>{opcao}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* --- CAMPO SELECT (Status Processual) --- */}
        <Autocomplete
          freeSolo
          options={opcoesStatusProcessual}
          value={form.status_processual || ''}
          onChange={(event, newValue) => {
            setForm(prev => ({ ...prev, status_processual: newValue }));
          }}
          onInputChange={(event, newInputValue) => {
            setForm(prev => ({ ...prev, status_processual: newInputValue }));
          }}
          renderInput={(params) => (
            <TextField {...params} label="Status Processual" variant="outlined" />
          )}
          fullWidth
        />

        <TextField
          name="data_prisao"
          label="Data da Prisão"
          value={form.data_prisao || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
          type="date"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          name="local_segregacao"
          label="Local de Segregação"
          value={form.local_segregacao || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />
        <TextField
          name="numero_da_guia"
          label="Número da Guia (Opcional)"
          value={form.numero_da_guia || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />

        <FormControl fullWidth>
          <InputLabel id="tipo-guia-label">Tipo de Guia (Opcional)</InputLabel>
          <Select
            labelId="tipo-guia-label"
            id="tipo_guia"
            name="tipo_guia"
            value={form.tipo_guia || ''}
            label="Tipo de Guia (Opcional)"
            onChange={handleChange}
          >
            <MenuItem value=""><em>Nenhuma</em></MenuItem>
            <MenuItem value="Provisória">Provisória</MenuItem>
            <MenuItem value="Definitiva">Definitiva</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ gridColumn: '1 / -1', mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar Cadastro'}
          </Button>
        </Box>
      </Paper>

      {/* Componente de Alerta/Notificação */}
      <Snackbar
        open={snack.open}
        autoHideDuration={6000} // 6 segundos
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