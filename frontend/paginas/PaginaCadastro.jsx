import React, { useState, forwardRef } from 'react';
import axios from 'axios';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, FormHelperText
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
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


// Lê a variável de ambiente VITE_API_URL definida no Railway (ou outro deploy).
// Se ela não existir (estamos rodando localmente), usa o endereço local como padrão.
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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
};

export function PaginaCadastro() {
  const [form, setForm] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [cpfError, setCpfError] = useState(false); // Estado para o erro do CPF
  const navigate = useNavigate();

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validação de CPF em tempo real
    if (name === 'cpf') {
      const soNumeros = value.replace(/[^\d]+/g, '');
      if (soNumeros.length === 11) {
        setCpfError(!validarCPF(soNumeros)); // Se não for válido, cpfError = true
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
        }
      ]
    };

    try {
      const response = await axios.post(`${API_URL}/api/cadastro-completo`, payload);
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

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: '#333', mb: 3 }}>
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
        <FormControl fullWidth>
          <InputLabel id="status-processual-label">Status Processual</InputLabel>
          <Select
            labelId="status-processual-label"
            id="status_processual"
            name="status_processual"
            value={form.status_processual || ''}
            label="Status Processual"
            onChange={handleChange}
          >
            {opcoesStatusProcessual.map((opcao) => (
              <MenuItem key={opcao} value={opcao}>{opcao}</MenuItem>
            ))}
          </Select>
        </FormControl>

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