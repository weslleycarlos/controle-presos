import React from 'react';
import {
  Paper,
  Avatar,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export function PainelInfoPreso({
  preso,
  formatarData,
  onEditar,
  onDeletar,
  onExportar,
}) {
  return (
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

      {preso.processos && preso.processos[0] && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          <Chip label={preso.processos[0].tipo_prisao || 'Tipo N/A'} color="warning" />
          <Chip label={preso.processos[0].status_processual || 'Status N/A'} color="info" />
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 3, mb: 3 }}>
        <Button variant="contained" startIcon={<EditIcon />} onClick={onEditar}>
          Editar Dados Pessoais
        </Button>
        <Button variant="outlined" onClick={onExportar}>Exportar Relatório</Button>
        <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={onDeletar}>
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
  );
}
