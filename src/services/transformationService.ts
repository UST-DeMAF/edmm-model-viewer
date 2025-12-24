import { v4 as uuidv4 } from 'uuid'

export interface TechnologySpecificDeploymentModel {
  technology: string
  locationURL: string
  commands: string[]
  options: string[]
}

export interface TransformationResult {
  transformationProcessId: string
  statusMessage: string
}

/**
 * Configuration for the DeMAF backend
 */
export const config = {
  analysisManagerUrl:
    import.meta.env.VITE_ANALYSIS_MANAGER_URL || '/analysismanager',
  tadmsUrl: import.meta.env.VITE_TADMS_URL || '/tadms',
  uploadUrl: import.meta.env.VITE_UPLOAD_URL || '/upload',
}

/**
 * Generates a random UUID to be used as a session ID.
 */
export function generateSessionId(): string {
  return uuidv4()
}

/**
 * Creates a technology-specific deployment model object.
 */
function createTSDM(
  technology: string,
  location: string,
  commands: string,
  options: string[],
): TechnologySpecificDeploymentModel {
  return {
    technology: technology.toLowerCase(),
    locationURL: encodeURI(location),
    commands: commands ? commands.split(',').map(cmd => cmd.trim()) : [''],
    options,
  }
}

/**
 * Checks if the total size of the uploaded files exceeds the maximum allowed size.
 */
export function checkTotalSize(files: File[]): boolean {
  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const maxSize = 50 * 1024 * 1024 // 50 MB
  return totalSize <= maxSize
}

/**
 * Fetches the list of registered plugins from the server.
 */
export async function getRegisteredPlugins(): Promise<string[]> {
  try {
    const response = await fetch(`${config.analysisManagerUrl}/demaf/plugins`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to get registered plugins')
    }

    const data = await response.json()
    // Remove "docker" from the list
    let pluginNames = data.pluginNames.filter(
      (name: string) => name !== 'docker',
    )
    // Rename "visualization-service" to "TADM"
    pluginNames = pluginNames.map((name: string) =>
      name === 'visualization-service' ? 'TADM' : name,
    )
    // Sort alphabetically
    pluginNames.sort()
    return pluginNames
  }
  catch (error) {
    console.error('Error getting registered plugins:', error)
    throw error
  }
}

/**
 * Saves a single uploaded file for transformation.
 */
export async function saveUploadedFileForTransformation(
  uploadedFile: File,
  sessionId: string,
): Promise<void> {
  const formData = new FormData()
  formData.append('file', uploadedFile)

  const response = await fetch(`${config.uploadUrl}?sessionId=${sessionId}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to upload file')
  }
}

/**
 * Saves multiple uploaded files for transformation.
 */
export async function saveUploadedFilesForTransformation(
  uploadedFiles: File[],
  sessionId: string,
): Promise<void> {
  const formData = new FormData()

  uploadedFiles.forEach((file) => {
    formData.append('files', file, file.webkitRelativePath)
    formData.append('relativePaths', file.webkitRelativePath)
  })

  const endpoint
    = uploadedFiles.length === 1
      ? `${config.uploadUrl}?sessionId=${sessionId}`
      : `${config.uploadUrl}-multiple?sessionId=${sessionId}`

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to upload files')
  }
}

/**
 * Calls the analysis manager to start the transformation process.
 */
export async function callAnalysisManagerTransformation(
  tsdm: TechnologySpecificDeploymentModel,
): Promise<string> {
  const response = await fetch(`${config.analysisManagerUrl}/demaf/transform`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tsdm),
  })

  if (!response.ok) {
    throw new Error('Failed to start transformation process')
  }

  const data = await response.json()
  return data
}

/**
 * Polls the status endpoint for the result of the transformation process.
 */
export async function pollTransformationProcessStatusForResult(
  transformationProcessId: string,
  delayInMilliSeconds: number,
): Promise<string> {
  const response = await fetch(
    `${config.analysisManagerUrl}/demaf/status/${transformationProcessId}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to get status for transformation process ${transformationProcessId}`,
    )
  }

  const message = await response.json()

  if (message.isFinished) {
    return message.result
  }
  else {
    await new Promise(resolve => setTimeout(resolve, delayInMilliSeconds))
    return pollTransformationProcessStatusForResult(
      transformationProcessId,
      delayInMilliSeconds,
    )
  }
}

/**
 * Handles the transformation process for a single uploaded file.
 */
export async function handleSingleFileTransformation(
  uploadedFile: File,
  session: string,
  selectedTechnology: string,
  commands: string,
  options: string[],
) {
  await saveUploadedFileForTransformation(uploadedFile, session)
  const transformationProcessName = uploadedFile.name
  const tsdm = createTSDM(
    selectedTechnology,
    `file:/usr/share/uploads/${session}/${transformationProcessName}`,
    commands,
    options,
  )
  return { transformationProcessName, tsdm }
}

/**
 * Handles the transformation process for multiple uploaded files.
 */
export async function handleMultipleFilesTransformation(
  uploadedFiles: File[],
  session: string,
  selectedTechnology: string,
  commands: string,
  options: string[],
  startFilePath: string,
) {
  const folderName = uploadedFiles[0].webkitRelativePath.split('/')[0]
  let transformationProcessName: string | undefined
  let tsdm: TechnologySpecificDeploymentModel

  if (startFilePath === '' || startFilePath === '*') {
    transformationProcessName = folderName
    tsdm = createTSDM(
      selectedTechnology,
      `file:/usr/share/uploads/${session}/${folderName}`,
      commands,
      options,
    )
  }
  else {
    const startFile = uploadedFiles.find(
      file => file.webkitRelativePath === `${folderName}/${startFilePath}`,
    )
    if (!startFile) {
      throw new Error('Start file not found in the uploaded folder.')
    }
    transformationProcessName = startFile.webkitRelativePath.split('/').at(-1)
    tsdm = createTSDM(
      selectedTechnology,
      `file:/usr/share/uploads/${session}/${startFile.webkitRelativePath}`,
      commands,
      options,
    )
  }

  await saveUploadedFilesForTransformation(uploadedFiles, session)
  return { transformationProcessName, tsdm }
}

/**
 * Starts the transformation process and polls for the result.
 */
export async function startTransformationProcess(
  tsdm: TechnologySpecificDeploymentModel,
) {
  const transformationProcessId = await callAnalysisManagerTransformation(tsdm)
  const statusMessage = await pollTransformationProcessStatusForResult(
    transformationProcessId,
    500,
  )
  return { transformationProcessId, statusMessage }
}

/**
 * Checks if a TADM exists on the server.
 */
export async function existsTADM(tadmId: string): Promise<boolean> {
  try {
    const response = await fetch(`${config.tadmsUrl}/exists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: `${tadmId}.yaml` }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.exists
  }
  catch {
    return false
  }
}

/**
 * Fetches a TADM YAML from the server.
 */
export async function fetchTADM(tadmId: string): Promise<string> {
  const response = await fetch(`${config.tadmsUrl}/${tadmId}.yaml`)

  if (!response.ok) {
    throw new Error(`Failed to fetch TADM: ${tadmId}`)
  }

  return response.text()
}

/**
 * Moves uploaded file to TADMS directory.
 */
export async function moveToTADMS(
  fileName: string,
  sessionId: string,
  taskId: string,
): Promise<void> {
  const response = await fetch('/move-to-tadms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName, sessionId, taskId }),
  })

  if (!response.ok) {
    throw new Error('Failed to move file to TADMS')
  }
}
