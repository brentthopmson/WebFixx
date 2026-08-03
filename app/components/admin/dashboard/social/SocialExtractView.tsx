import React from 'react';
import { parseJSONWithComments } from '../../../../../utils/helpers';
import { SocialExtract } from '../../../../types/extracts';
import { CollapsibleContactList } from '../details/CollapsibleContactList';
import { ActivitiesSection } from '../details/ActivitiesSection';

interface SocialExtractViewProps {
  data: string;
}

export const SocialExtractView = ({ data }: SocialExtractViewProps) => {
  try {
    // Handle both string and parsed data formats
    let parsedData;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = parseJSONWithComments(data);
      }
    } else {
      parsedData = data;
    }

    if (!parsedData || !Array.isArray(parsedData)) {
      console.error('Invalid social extract data format:', parsedData);
      return <div className="dark:text-white">Invalid data format</div>;
    }

    return (
      <div className="space-y-6">
        {parsedData.map((account, index) => (
          <div key={index} className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium dark:text-white">
                {account.platform}
                <span className="text-sm text-gray-500 ml-2 dark:text-gray-400">({account.username})</span>
              </h3>
              <span className={`px-2 py-1 rounded-full text-sm ${
                account.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {account.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Used</p>
                <p className="font-medium dark:text-gray-200">{new Date(account.lastUsed).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">IP Address</p>
                <p className="font-medium dark:text-gray-200">{account.ipAddress}</p>
              </div>
            </div>

            {account.device && (
              <div className="bg-gray-50 p-3 rounded-lg mb-4 dark:bg-gray-700">
                <h4 className="font-medium mb-2 dark:text-white">Device Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm dark:text-gray-200">
                  <p><span className="text-gray-500 dark:text-gray-400">Browser:</span> {account.device.browser}</p>
                  <p><span className="text-gray-500 dark:text-gray-400">OS:</span> {account.device.os}</p>
                </div>
              </div>
            )}

            {account.extractedDetails && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Followers</p>
                    <p className="font-medium dark:text-gray-200">{account.extractedDetails.followersCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Following</p>
                    <p className="font-medium dark:text-gray-200">{account.extractedDetails.followingCount}</p>
                  </div>
                </div>

                {account.extractedDetails.recentActivity && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2 dark:text-white">Recent Activity</h4>
                    <div className="space-y-2">
                      {account.extractedDetails.recentActivity.map((activity: any, aIndex: number) => (
                        <div key={aIndex} className="bg-gray-50 p-2 rounded text-sm dark:bg-gray-700 dark:text-gray-200">
                          <p>{activity.type} on {activity.on}</p>
                          {activity.text && <p className="text-gray-600 mt-1 dark:text-gray-300">{activity.text}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {account.extractedDetails.followers && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2 dark:text-white">Top Followers</h4>
                    <div className="space-y-3">
                      {account.extractedDetails.followers.slice(0, 3).map((follower: any, fIndex: number) => (
                        <div key={fIndex} className="bg-gray-50 p-3 rounded-lg dark:bg-gray-700">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium dark:text-white">{follower.fullName}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">@{follower.username}</p>
                            </div>
                            {follower.isFollowingYou && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-200">
                                Follows you
                              </span>
                            )}
                          </div>
                          {follower.relationshipSummary && (
                            <p className="text-sm text-gray-600 mt-2 dark:text-gray-300">{follower.relationshipSummary}</p>
                          )}
                          <div className="mt-2 text-sm">
                            <p><span className="text-gray-500 dark:text-gray-400">Email:</span> {follower.email}</p>
                            <p><span className="text-gray-500 dark:text-gray-400">Phone:</span> {follower.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {account.extractedDetails.contacts && (
                  <CollapsibleContactList
                    contacts={account.extractedDetails.contacts}
                    title="Contacts"
                    maxHeight="max-h-80"
                  />
                )}

                {account.extractedDetails.activities && (
                  <ActivitiesSection activities={account.extractedDetails.activities} />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return <div className="dark:text-white">Error parsing data</div>;
  }
};
