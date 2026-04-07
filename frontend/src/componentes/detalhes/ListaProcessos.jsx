import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Grid,
  Divider,
  Button,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GavelIcon from '@mui/icons-material/Gavel';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

export function ListaProcessos({
  processos,
  formatarData,
  tiposDeEvento,
  onEditarProcesso,
  onAbrirEvento,
  onEditarEvento,
  onDeletarEvento
}) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
        Processos Vinculados ({processos.length})
      </Typography>

      <Box>
        {processos.length > 0 ? (
          processos.map((proc, index) => (
            <Accordion key={proc.id} defaultExpanded={index === 0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <GavelIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography sx={{ fontWeight: 'bold', flexGrow: 1, wordBreak: 'break-all', mr: 2 }}>
                  Processo: {proc.numero_processo}
                </Typography>
                <Tooltip title="Editar Processo">
                  <IconButton
                    aria-label="Editar processo"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditarProcesso(proc);
                    }}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: 'action.hover' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5
                  }}
                >
                  <Typography variant="body2"><strong>Status:</strong> {proc.status_processual || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Tipo da Prisão:</strong> {proc.tipo_prisao || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Data da Prisão:</strong> {formatarData(proc.data_prisao)}</Typography>
                  <Typography variant="body2"><strong>Local:</strong> {proc.local_segregacao || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Número da Guia:</strong> {proc.numero_da_guia || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Tipo de Guia:</strong> {proc.tipo_guia || 'N/A'}</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Eventos / Histórico ({proc.eventos.length})
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => onAbrirEvento(proc.id)}
                  >
                    Adicionar Evento
                  </Button>
                </Box>

                {proc.eventos.length > 0 ? (
                  proc.eventos.map((evento) => (
                    <Paper key={evento.id} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2">
                          <strong>{tiposDeEvento[evento.tipo_evento] || evento.tipo_evento}:</strong> {formatarData(evento.data_evento, true)}
                        </Typography>
                        {evento.descricao && (
                          <Typography variant="caption" color="text.secondary">
                            {evento.descricao}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <Tooltip title="Editar Evento">
                          <IconButton size="small" onClick={() => onEditarEvento(evento, proc.id)} sx={{ mr: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir Evento">
                          <IconButton size="small" onClick={() => onDeletarEvento(evento.id)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    Nenhum evento futuro cadastrado.
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))
        ) : (
          <Alert severity="info">Nenhum processo cadastrado para esta pessoa.</Alert>
        )}
      </Box>
    </Paper>
  );
}
