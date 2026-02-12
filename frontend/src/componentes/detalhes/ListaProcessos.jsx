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

export function ListaProcessos({
  processos,
  formatarData,
  tiposDeEvento,
  onEditarProcesso,
  onAbrirEvento,
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
                <Typography sx={{ fontWeight: 'bold', flexGrow: 1 }}>
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
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2"><strong>Status:</strong> {proc.status_processual || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2"><strong>Tipo da Prisão:</strong> {proc.tipo_prisao || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2"><strong>Data da Prisão:</strong> {formatarData(proc.data_prisao)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2"><strong>Local:</strong> {proc.local_segregacao || 'N/A'}</Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Eventos Futuros ({proc.eventos.length})
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
                    <Paper key={evento.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{tiposDeEvento[evento.tipo_evento] || evento.tipo_evento}:</strong> {formatarData(evento.data_evento, true)}
                      </Typography>
                      {evento.descricao && (
                        <Typography variant="caption" color="text.secondary">
                          {evento.descricao}
                        </Typography>
                      )}
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
