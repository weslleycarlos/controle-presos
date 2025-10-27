import React from 'react';
import { Box, Typography, Paper, Link } from '@mui/material';

export function PaginaAjuda() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: '#333', mb: 3 }}>
        Ajuda e Suporte
      </Typography>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Sobre o Sistema
        </Typography>
        <Typography paragraph>
          Este é um Sistema de Controle de Presos focado em agilizar o acompanhamento
          processual e a gestão de alertas de prazos. O objetivo é garantir que 
          nenhuma audiência ou prazo de reavaliação seja perdido por falta de aviso.
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Perguntas Frequentes (FAQ)
        </Typography>
        
        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
          1. Como eu cadastro um novo preso?
        </Typography>
        <Typography paragraph>
          No menu lateral, clique em "Novo Cadastro". Preencha os dados pessoais
          e os dados do primeiro processo associado. Campos com * (asterisco)
          são obrigatórios.
        </Typography>

        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
          2. Como eu adiciono uma audiência ou prazo?
        </Typography>
        <Typography paragraph>
          Vá até o "Dashboard", encontre o preso e clique em "Ver Detalhes".
          Na página de detalhes, encontre o processo desejado, expanda-o (clicando na
          seta) e clique no botão "+ Adicionar Evento".
        </Typography>

        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
          3. O que é a página de "Alertas de Prazo"?
        </Typography>
        <Typography paragraph>
          Essa página mostra automaticamente todos os eventos (audiências, reavaliações)
          que estão programados para os próximos 7 dias. É a sua lista de tarefas
          prioritárias.
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Contato
        </Typography>
        <Typography paragraph>
          Para problemas técnicos ou sugestões, por favor, entre em contato com 
          o administrador do sistema pelo email: 
          <Link href="mailto:weslley.unemat@gmail.com"> weslley.unemat@gmail.com</Link>.
        </Typography>
      </Paper>
    </Box>
  );
}