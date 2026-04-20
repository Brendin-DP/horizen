/**
 * Slack Incoming Webhook notifications. Set SLACK_WEBHOOK_URL; otherwise notifications are skipped.
 */

export async function sendSlackMessage(blocks) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('SLACK_WEBHOOK_URL not set — skipping Slack notification');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks),
    });

    if (!res.ok) {
      console.error('Slack notification failed:', res.status, await res.text());
    }
  } catch (err) {
    // Never let Slack failure crash the API response
    console.error('Slack notification error:', err.message);
  }
}

export function featureRequestMessage({ memberName, title, description }) {
  return {
    text: `New Feature Request from ${memberName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 New Feature Request',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*From:*\n${memberName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Submitted:*\n${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title:*\n${title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:*\n${description}`,
        },
      },
      {
        type: 'divider',
      },
    ],
  };
}

export function exerciseRequestMessage({ memberName, exerciseName, category, type, notes }) {
  const fields = [
    {
      type: 'mrkdwn',
      text: `*From:*\n${memberName}`,
    },
    {
      type: 'mrkdwn',
      text: `*Submitted:*\n${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    },
  ];

  if (category) {
    fields.push({
      type: 'mrkdwn',
      text: `*Category:*\n${category}`,
    });
  }

  if (type) {
    fields.push({
      type: 'mrkdwn',
      text: `*Type:*\n${type}`,
    });
  }

  return {
    text: `New Exercise Request from ${memberName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💪 New Exercise Request',
        },
      },
      {
        type: 'section',
        fields,
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Exercise Name:*\n${exerciseName}`,
        },
      },
      ...(notes
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Notes:*\n${notes}`,
              },
            },
          ]
        : []),
      {
        type: 'divider',
      },
    ],
  };
}
