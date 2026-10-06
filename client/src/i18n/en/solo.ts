export const solo = {
  onYourOwn: 'On your own',
  leave: 'Leave',
  linkCopied: 'Link copied',
  challengeFriend: 'Challenge a friend',
  copyChallengeLink: 'Copy challenge link',
  today: 'Today',
  yesterday: 'Yesterday',
  date: (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
};
